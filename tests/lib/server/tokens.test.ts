import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readActiveToken, saveInProgressAnswers, markTokenCompleted } from '$lib/server/tokens';
import type { Firestore, DocumentReference, Transaction } from 'firebase-admin/firestore';

// ─── Hoist MockTimestamp so vi.mock factory can reference it ─────────────────
// vi.mock calls are hoisted above imports by Vitest; class declarations are not.
// vi.hoisted runs before the hoist boundary.

const { MockTimestamp } = vi.hoisted(() => {
  class MockTimestamp {
    private ms: number;
    constructor(ms: number) { this.ms = ms; }
    toMillis() { return this.ms; }
    static now() { return new MockTimestamp(Date.now()); }
    static fromMillis(ms: number) { return new MockTimestamp(ms); }
  }
  return { MockTimestamp };
});

// Timestamp must be a real constructor so z.instanceof(Timestamp) works.
vi.mock('firebase-admin/firestore', () => ({
  Timestamp: MockTimestamp,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockTimestamp(ms: number) {
  return new MockTimestamp(ms);
}

function makeFirestoreMock(snapExists: boolean, snapData: Record<string, unknown> | null) {
  const snap = {
    exists: snapExists,
    data: () => snapData,
  };
  const docRef = {
    get: vi.fn().mockResolvedValue(snap),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const db = {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue(docRef),
    }),
  } as unknown as Firestore;
  return { db, docRef, snap };
}

function pendingTokenData(overrides: Record<string, unknown> = {}) {
  return {
    companyId: 'company-1',
    employeeId: 'employee-1',
    role: 'executive',
    status: 'pending',
    createdAt: makeMockTimestamp(Date.now() - 1000),
    expiresAt: makeMockTimestamp(Date.now() + 86_400_000), // +1 day
    ...overrides,
  };
}

// ─── readActiveToken ──────────────────────────────────────────────────────────

describe('readActiveToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok:true with ref and data for a pending token', async () => {
    const { db } = makeFirestoreMock(true, pendingTokenData());
    const result = await readActiveToken(db, 'tok-abc');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.status).toBe('pending');
      expect(result.value.data.companyId).toBe('company-1');
    }
  });

  it('returns ok:true for an inProgress token', async () => {
    const { db } = makeFirestoreMock(true, pendingTokenData({ status: 'inProgress' }));
    const result = await readActiveToken(db, 'tok-xyz');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.status).toBe('inProgress');
    }
  });

  it('returns 404 when token document does not exist', async () => {
    const { db } = makeFirestoreMock(false, null);
    const result = await readActiveToken(db, 'nonexistent');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it('returns 410 when token status is completed', async () => {
    const { db } = makeFirestoreMock(true, pendingTokenData({ status: 'completed' }));
    const result = await readActiveToken(db, 'done-tok');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(410);
    }
  });

  it('returns 410 when token status is expired', async () => {
    const { db } = makeFirestoreMock(true, pendingTokenData({ status: 'expired' }));
    const result = await readActiveToken(db, 'exp-tok');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(410);
    }
  });

  it('returns 410 when expiresAt is in the past', async () => {
    const { db } = makeFirestoreMock(
      true,
      pendingTokenData({ expiresAt: makeMockTimestamp(Date.now() - 1000) })
    );
    const result = await readActiveToken(db, 'old-tok');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(410);
    }
  });

  it('returns 500 when document data fails schema parse', async () => {
    const { db } = makeFirestoreMock(true, { role: 'INVALID_ROLE', status: 'pending' });
    const result = await readActiveToken(db, 'bad-tok');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });

  it('includes partialAnswers in token data when present', async () => {
    const partialAnswers = [{ questionId: 'executive-p1-q1', value: 3 }];
    const { db } = makeFirestoreMock(true, pendingTokenData({ partialAnswers }));
    const result = await readActiveToken(db, 'partial-tok');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.partialAnswers).toEqual(partialAnswers);
    }
  });
});

// ─── saveInProgressAnswers ────────────────────────────────────────────────────

describe('saveInProgressAnswers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes only the incoming pillar answers when no prior answers exist', async () => {
    const { db, docRef } = makeFirestoreMock(true, {
      role: 'executive',
      status: 'pending',
    });
    const p1Answers = [{ questionId: 'executive-p1-q1', value: 4 as const }];
    const result = await saveInProgressAnswers(db, 'tok-abc', 1, p1Answers);
    expect(result.ok).toBe(true);
    expect(docRef.update).toHaveBeenCalledWith({
      status: 'inProgress',
      partialAnswers: p1Answers,
    });
  });

  it('merges pillar 2 answers while preserving pillar 1 answers', async () => {
    const p1Answers = Array.from({ length: 7 }, (_, i) => ({
      questionId: `executive-p1-q${i + 1}`,
      value: 3 as const,
    }));
    const { db, docRef } = makeFirestoreMock(true, {
      role: 'executive',
      status: 'inProgress',
      partialAnswers: p1Answers,
    });
    const p2Answers = Array.from({ length: 7 }, (_, i) => ({
      questionId: `executive-p2-q${i + 1}`,
      value: 4 as const,
    }));
    const result = await saveInProgressAnswers(db, 'tok-abc', 2, p2Answers);
    expect(result.ok).toBe(true);
    expect(docRef.update).toHaveBeenCalledWith({
      status: 'inProgress',
      partialAnswers: [...p1Answers, ...p2Answers],
    });
  });

  it('replaces pillar 2 entries on a second call — other pillars intact', async () => {
    const p1Answers = Array.from({ length: 7 }, (_, i) => ({
      questionId: `executive-p1-q${i + 1}`,
      value: 3 as const,
    }));
    const p2First = Array.from({ length: 7 }, (_, i) => ({
      questionId: `executive-p2-q${i + 1}`,
      value: 2 as const,
    }));
    const { db, docRef } = makeFirestoreMock(true, {
      role: 'executive',
      status: 'inProgress',
      partialAnswers: [...p1Answers, ...p2First],
    });
    const p2Second = Array.from({ length: 7 }, (_, i) => ({
      questionId: `executive-p2-q${i + 1}`,
      value: 5 as const,
    }));
    const result = await saveInProgressAnswers(db, 'tok-abc', 2, p2Second);
    expect(result.ok).toBe(true);
    const updateCall = docRef.update.mock.calls[0]?.[0] as { partialAnswers: { questionId: string; value: number }[] };
    // Pillar 1 answers still present
    p1Answers.forEach((a) => {
      expect(updateCall.partialAnswers).toContainEqual(a);
    });
    // Pillar 2 answers replaced with second batch
    p2Second.forEach((a) => {
      expect(updateCall.partialAnswers).toContainEqual(a);
    });
    // Old pillar 2 answers gone
    p2First.forEach((a) => {
      expect(updateCall.partialAnswers).not.toContainEqual(a);
    });
  });

  it('returns 404 when token does not exist', async () => {
    const { db } = makeFirestoreMock(false, null);
    const result = await saveInProgressAnswers(db, 'missing', 1, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it('returns 410 when token is completed', async () => {
    const { db } = makeFirestoreMock(true, { role: 'executive', status: 'completed' });
    const result = await saveInProgressAnswers(db, 'done', 1, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(410);
    }
  });

  it('returns 410 when token is expired', async () => {
    const { db } = makeFirestoreMock(true, { role: 'executive', status: 'expired' });
    const result = await saveInProgressAnswers(db, 'exp', 1, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(410);
    }
  });
});

// ─── markTokenCompleted ────────────────────────────────────────────────────────

describe('markTokenCompleted', () => {
  it('calls t.update with status completed and consumedAt', () => {
    const tUpdate = vi.fn();
    const t = { update: tUpdate } as unknown as Transaction;
    const tokenRef = {} as DocumentReference;
    const now = makeMockTimestamp(Date.now()) as unknown as import('firebase-admin/firestore').Timestamp;
    markTokenCompleted(t, tokenRef, now);
    expect(tUpdate).toHaveBeenCalledWith(tokenRef, {
      status: 'completed',
      consumedAt: now,
    });
  });
});
