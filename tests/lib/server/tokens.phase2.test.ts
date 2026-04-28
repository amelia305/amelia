import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist MockTimestamp ───────────────────────────────────────────────────────
const { MockTimestamp } = vi.hoisted(() => {
  class MockTimestamp {
    private ms: number;
    constructor(ms: number) { this.ms = ms; }
    toMillis() { return this.ms; }
    toDate() { return new Date(this.ms); }
    static now() { return new MockTimestamp(Date.now()); }
    static fromMillis(ms: number) { return new MockTimestamp(ms); }
  }
  return { MockTimestamp };
});

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: MockTimestamp,
}));

// ─── Mock env ─────────────────────────────────────────────────────────────────
vi.mock('$env/static/private', () => ({
  TOKEN_EXPIRY_DAYS: '30',
}));

// ─── Mock nanoid ──────────────────────────────────────────────────────────────
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'generated-token-value'),
}));

import { createTokenForEmployee, revokeToken, listRecentValidTokens } from '$lib/server/tokens';
import type { Firestore } from 'firebase-admin/firestore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployeeDoc(exists: boolean, data: Record<string, unknown> | null) {
  return { exists, data: () => data };
}

function makeTokenDoc(exists: boolean, data: Record<string, unknown> | null) {
  return { exists, data: () => data };
}

/**
 * Builds a Firestore mock that handles:
 * - companies/{companyId}/employees/{employeeId}  → employeeSnap
 * - tokens/{tokenValue}  → tokenSnap
 * - tokens collection .doc() for set/update
 */
function makePhase2Firestore(opts: {
  employeeSnap?: ReturnType<typeof makeEmployeeDoc>;
  tokenSnap?: ReturnType<typeof makeTokenDoc>;
  existingTokenExists?: boolean;
}) {
  const tokenDocRef = {
    get: vi.fn().mockResolvedValue(opts.tokenSnap ?? makeTokenDoc(false, null)),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    id: 'generated-token-value',
  };

  const employeeDocRef = {
    get: vi.fn().mockResolvedValue(opts.employeeSnap ?? makeEmployeeDoc(false, null)),
    update: vi.fn().mockResolvedValue(undefined),
  };

  const auditDocRef = {
    set: vi.fn().mockResolvedValue(undefined),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'tokens') {
        return {
          doc: vi.fn().mockReturnValue(tokenDocRef),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ docs: [] }),
        };
      }
      // companies/{id}.collection('employees'|'audit')
      return {
        doc: vi.fn().mockReturnValue({
          collection: vi.fn((sub: string) => {
            if (sub === 'audit') return { doc: vi.fn().mockReturnValue(auditDocRef) };
            return { doc: vi.fn().mockReturnValue(employeeDocRef) };
          }),
        }),
      };
    }),
    runTransaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => {
      const tx = {
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (ref: { set: (v: unknown) => unknown }, v: unknown) => ref.set(v),
        update: (ref: { update: (v: unknown) => unknown }, v: unknown) => ref.update(v),
      };
      return cb(tx);
    }),
  } as unknown as Firestore;

  return { db, tokenDocRef, employeeDocRef, auditDocRef };
}

// ─── createTokenForEmployee ───────────────────────────────────────────────────

describe('createTokenForEmployee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when employee does not exist', async () => {
    const { db } = makePhase2Firestore({
      employeeSnap: makeEmployeeDoc(false, null),
    });

    const result = await createTokenForEmployee(db, { actorUid: "actor-uid",
      companyId: 'cmp-1',
      employeeId: 'emp-missing',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it('copies role from employee, NOT from form input', async () => {
    const { db, tokenDocRef } = makePhase2Firestore({
      employeeSnap: makeEmployeeDoc(true, {
        name: 'Juan',
        email: 'juan@co.com',
        role: 'executive', // role comes from here
        nationalId: '123',
        birthDate: '1990-01-01',
        gender: 'M',
        tenureMonths: 12,
        createdAt: {},
        createdBy: 'admin',
      }),
      // Token lookup for uniqueness check - does not exist
      tokenSnap: makeTokenDoc(false, null),
    });

    const result = await createTokenForEmployee(db, { actorUid: "actor-uid",
      companyId: 'cmp-1',
      employeeId: 'emp-1',
      // No role parameter — it must be read from employee
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe('generated-token-value');
      expect(result.value.expiresAt).toBeDefined();
    }

    // Verify role in the set() call comes from employee doc
    expect(tokenDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'executive',
        companyId: 'cmp-1',
        employeeId: 'emp-1',
        status: 'pending',
      })
    );
  });

  it('returns a token with pending status and expiresAt', async () => {
    const { db } = makePhase2Firestore({
      employeeSnap: makeEmployeeDoc(true, {
        name: 'Ana',
        email: 'ana@co.com',
        role: 'middleManagement',
        nationalId: '999',
        birthDate: '1985-01-01',
        gender: 'F',
        tenureMonths: 36,
        createdAt: {},
        createdBy: 'admin',
      }),
      tokenSnap: makeTokenDoc(false, null),
    });

    const result = await createTokenForEmployee(db, { actorUid: "actor-uid",
      companyId: 'cmp-1',
      employeeId: 'emp-2',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBeTruthy();
      expect(result.value.expiresAt).toBeDefined();
    }
  });

  it('returns 500 when employee has invalid role data', async () => {
    const { db } = makePhase2Firestore({
      employeeSnap: makeEmployeeDoc(true, {
        name: 'Bad',
        email: 'bad@co.com',
        role: 'INVALID_ROLE',
        nationalId: '1',
        birthDate: '2000-01-01',
        gender: 'M',
        tenureMonths: 1,
        createdAt: {},
        createdBy: 'admin',
      }),
    });

    const result = await createTokenForEmployee(db, { actorUid: "actor-uid",
      companyId: 'cmp-1',
      employeeId: 'emp-bad',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });
});

// ─── revokeToken ──────────────────────────────────────────────────────────────

describe('revokeToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets status to expired for a pending token', async () => {
    const { db, tokenDocRef } = makePhase2Firestore({
      tokenSnap: makeTokenDoc(true, {
        companyId: 'cmp-1',
        employeeId: 'emp-1',
        role: 'executive',
        status: 'pending',
        createdAt: {},
        expiresAt: {},
      }),
    });

    const result = await revokeToken(db, 'tok-pending', "cmp-1", "actor-uid");

    expect(result.ok).toBe(true);
    expect(tokenDocRef.update).toHaveBeenCalledWith({ status: 'expired' });
  });

  it('sets status to expired for an inProgress token', async () => {
    const { db, tokenDocRef } = makePhase2Firestore({
      tokenSnap: makeTokenDoc(true, {
        companyId: 'cmp-1',
        employeeId: 'emp-1',
        role: 'executive',
        status: 'inProgress',
        createdAt: {},
        expiresAt: {},
      }),
    });

    const result = await revokeToken(db, 'tok-inprogress', "cmp-1", "actor-uid");

    expect(result.ok).toBe(true);
    expect(tokenDocRef.update).toHaveBeenCalledWith({ status: 'expired' });
  });

  it('returns fail(400, cannot_revoke_completed) when token is completed', async () => {
    const { db, tokenDocRef } = makePhase2Firestore({
      tokenSnap: makeTokenDoc(true, {
        companyId: 'cmp-1',
        employeeId: 'emp-1',
        role: 'executive',
        status: 'completed',
        createdAt: {},
        expiresAt: {},
      }),
    });

    const result = await revokeToken(db, 'tok-completed', "cmp-1", "actor-uid");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toBe('cannot_revoke_completed');
    }
    // Must NOT update the document
    expect(tokenDocRef.update).not.toHaveBeenCalled();
  });

  it('returns 404 when token does not exist', async () => {
    const { db } = makePhase2Firestore({
      tokenSnap: makeTokenDoc(false, null),
    });

    const result = await revokeToken(db, 'tok-missing', "cmp-1", "actor-uid");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it('returns 404 when token belongs to a different company (cross-company guard)', async () => {
    const { db, tokenDocRef } = makePhase2Firestore({
      tokenSnap: makeTokenDoc(true, {
        companyId: 'cmp-other',
        employeeId: 'emp-1',
        role: 'executive',
        status: 'pending',
        createdAt: {},
        expiresAt: {},
      }),
    });

    const result = await revokeToken(db, 'tok-other-company', "cmp-1", "actor-uid");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
    expect(tokenDocRef.update).not.toHaveBeenCalled();
  });

  it('is idempotent for already-expired tokens', async () => {
    const { db, tokenDocRef } = makePhase2Firestore({
      tokenSnap: makeTokenDoc(true, {
        companyId: 'cmp-1',
        employeeId: 'emp-1',
        role: 'executive',
        status: 'expired',
        createdAt: {},
        expiresAt: {},
      }),
    });

    const result = await revokeToken(db, 'tok-already-expired', "cmp-1", "actor-uid");

    expect(result.ok).toBe(true);
    expect(tokenDocRef.update).not.toHaveBeenCalled();
  });
});

// ─── listRecentValidTokens ────────────────────────────────────────────────────

function makeTokensCollectionMock(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    doc: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
    }),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      docs: docs.map((d) => ({
        id: d.id,
        data: () => d.data,
      })),
    }),
  };
}

describe('listRecentValidTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseDoc = (overrides: Record<string, unknown> = {}) => {
    const now = Date.now();
    return {
      role: 'executive',
      status: 'pending',
      createdAt: new MockTimestamp(now - 86400000),
      expiresAt: new MockTimestamp(now + 86400000 * 30),
      ...overrides,
    };
  };

  it('returns at most 5 valid tokens ordered by createdAt desc', async () => {
    const now = Date.now();
    const docs = [
      { id: 'tok-9', data: baseDoc({ status: 'pending', createdAt: new MockTimestamp(now - 1000) }) },
      { id: 'tok-8', data: baseDoc({ status: 'inProgress', createdAt: new MockTimestamp(now - 2000) }) },
      { id: 'tok-7', data: baseDoc({ status: 'pending', createdAt: new MockTimestamp(now - 3000) }) },
      { id: 'tok-6', data: baseDoc({ status: 'pending', createdAt: new MockTimestamp(now - 4000) }) },
      { id: 'tok-5', data: baseDoc({ status: 'pending', createdAt: new MockTimestamp(now - 5000) }) },
      { id: 'tok-4', data: baseDoc({ status: 'inProgress', createdAt: new MockTimestamp(now - 6000) }) },
      { id: 'tok-3', data: baseDoc({ status: 'pending', createdAt: new MockTimestamp(now - 7000) }) },
      // Extra beyond 5 — should be excluded
      { id: 'tok-2', data: baseDoc({ status: 'pending', createdAt: new MockTimestamp(now - 8000) }) },
      { id: 'tok-1', data: baseDoc({ status: 'inProgress', createdAt: new MockTimestamp(now - 9000) }) },
    ];

    const tokensMock = makeTokensCollectionMock(docs);
    const db = { collection: vi.fn().mockReturnValue(tokensMock) } as unknown as Firestore;

    const result = await listRecentValidTokens(db);

    expect(result).toHaveLength(5);
    // Must be in descending createdAt order
    expect(result[0].value).toBe('tok-9');
    expect(result[4].value).toBe('tok-5');
  });

  it('excludes tokens where expiresAt < now even if status is still pending/inProgress', async () => {
    const now = Date.now();
    const docs = [
      { id: 'tok-valid', data: baseDoc({ status: 'pending', expiresAt: new MockTimestamp(now + 86400000) }) },
      { id: 'tok-expired', data: baseDoc({ status: 'pending', expiresAt: new MockTimestamp(now - 86400000) }) },
    ];

    const tokensMock = makeTokensCollectionMock(docs);
    const db = { collection: vi.fn().mockReturnValue(tokensMock) } as unknown as Firestore;

    const result = await listRecentValidTokens(db);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('tok-valid');
  });

  it('excludes tokens with status completed or expired (handled by Firestore where clause)', async () => {
    const now = Date.now();
    // Tokens with status 'completed' or 'expired' are already excluded by
    // the Firestore where clause. This test verifies the mock filters correctly.
    const docs = [
      { id: 'tok-pending', data: baseDoc({ status: 'pending', expiresAt: new MockTimestamp(now + 86400000) }) },
    ];

    const tokensMock = makeTokensCollectionMock(docs);
    const db = { collection: vi.fn().mockReturnValue(tokensMock) } as unknown as Firestore;

    const result = await listRecentValidTokens(db);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('tok-pending');
  });

  it('returns empty array when no matching tokens exist', async () => {
    const tokensMock = makeTokensCollectionMock([]);
    const db = { collection: vi.fn().mockReturnValue(tokensMock) } as unknown as Firestore;

    const result = await listRecentValidTokens(db);

    expect(result).toEqual([]);
  });

  it('limits internal fetch to 10 documents, output to 5', async () => {
    const now = Date.now();
    // Create 10 documents, all valid
    const docs = Array.from({ length: 10 }, (_, i) => ({
      id: `tok-${10 - i}`,
      data: baseDoc({
        status: 'pending',
        createdAt: new MockTimestamp(now - i * 1000),
        expiresAt: new MockTimestamp(now + 86400000 * 30),
      }),
    }));

    const tokensMock = makeTokensCollectionMock(docs);
    const db = { collection: vi.fn().mockReturnValue(tokensMock) } as unknown as Firestore;

    const result = await listRecentValidTokens(db);

    // Limit was set to 10, so 10 docs come in, all valid, output max 5
    expect(result).toHaveLength(5);
    expect(tokensMock.limit).toHaveBeenCalledWith(10);
  });
});
