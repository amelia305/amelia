import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Timestamp ───────────────────────────────────────────────────────────
vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: vi.fn(() => ({ seconds: 1000, nanoseconds: 0 })),
  },
}));

import { listEmployeesForCompany, createEmployee, archiveEmployee } from '$lib/server/employees';
import type { Firestore } from 'firebase-admin/firestore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validEmployeeData(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Juan Pérez',
    email: 'juan@company.com',
    role: 'executive',
    nationalId: '12345678',
    birthDate: '1990-01-01',
    gender: 'M',
    tenureMonths: 24,
    createdAt: { seconds: 900 },
    createdBy: 'adminEmpresa',
    ...overrides,
  };
}

function makeListFirestore(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const querySnap = { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
  const colRef = {
    orderBy: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(querySnap) }),
  };
  const docRef = {
    collection: vi.fn().mockReturnValue(colRef),
  };
  return {
    collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(docRef) }),
  } as unknown as Firestore;
}

function makeDocFirestore(docId: string, exists: boolean, data: Record<string, unknown> | null) {
  const snap = { id: docId, exists, data: () => data };
  const docRef = {
    get: vi.fn().mockResolvedValue(snap),
    update: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    id: 'new-emp-id',
  };
  const employeesCol = {
    orderBy: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
    doc: vi.fn().mockReturnValue(docRef),
  };
  const companyDocRef = {
    collection: vi.fn().mockReturnValue(employeesCol),
  };
  // Transaction stub: delegates get/set/update back to the same doc mocks so
  // assertions on docRef.set/update still work.
  const tx = {
    get: (ref: { get: () => Promise<unknown> }) => ref.get(),
    set: (ref: { set: (v: unknown) => unknown }, v: unknown) => ref.set(v),
    update: (ref: { update: (v: unknown) => unknown }, v: unknown) => ref.update(v),
  };
  return {
    db: {
      collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(companyDocRef) }),
      runTransaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    } as unknown as Firestore,
    docRef,
  };
}

// ─── listEmployeesForCompany ──────────────────────────────────────────────────

describe('listEmployeesForCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only active employees by default (archived filtered out)', async () => {
    const db = makeListFirestore([
      { id: 'emp-1', data: validEmployeeData({ archived: false }) },
      { id: 'emp-2', data: validEmployeeData({ archived: true }) },
    ]);
    const result = await listEmployeesForCompany(db, 'cmp-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('emp-1');
  });

  it('includes archived employees when showArchived=true', async () => {
    const db = makeListFirestore([
      { id: 'emp-1', data: validEmployeeData({ archived: false }) },
      { id: 'emp-2', data: validEmployeeData({ archived: true }) },
    ]);
    const result = await listEmployeesForCompany(db, 'cmp-1', { showArchived: true });
    expect(result).toHaveLength(2);
  });

  it('returns empty array when company has no employees', async () => {
    const db = makeListFirestore([]);
    const result = await listEmployeesForCompany(db, 'cmp-1');
    expect(result).toEqual([]);
  });

  it('queries inside companies/{companyId}/employees — scoped correctly', async () => {
    const db = makeListFirestore([]);
    await listEmployeesForCompany(db, 'my-company-id');
    // Verify the chain: collection('companies').doc('my-company-id').collection('employees')
    expect(db.collection).toHaveBeenCalledWith('companies');
  });
});

// ─── createEmployee ───────────────────────────────────────────────────────────

describe('createEmployee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    name: 'Test',
    email: 'test@co.com',
    role: 'executive',
    nationalId: '12345678',
    birthDate: '1990-01-01',
    gender: 'male',
    tenureMonths: 24,
  };

  it('rejects missing email (Zod validation)', async () => {
    const { db } = makeDocFirestore('emp-id', false, null);
    await expect(
      createEmployee(db, { ...validInput, email: '' }, 'cmp-1', 'actor-uid')
    ).rejects.toThrow();
  });

  it('rejects invalid role (Zod validation)', async () => {
    const { db } = makeDocFirestore('emp-id', false, null);
    await expect(
      createEmployee(db, { ...validInput, role: 'INVALID_ROLE' }, 'cmp-1', 'actor-uid')
    ).rejects.toThrow();
  });

  it('rejects missing name', async () => {
    const { db } = makeDocFirestore('emp-id', false, null);
    await expect(
      createEmployee(db, { ...validInput, name: '' }, 'cmp-1', 'actor-uid')
    ).rejects.toThrow();
  });

  it('writes employee with companyId from param, not from input', async () => {
    const employeesColDocRef = {
      id: 'new-emp-123',
      set: vi.fn().mockResolvedValue(undefined),
    };
    const auditColDocRef = {
      id: 'audit-1',
      set: vi.fn().mockResolvedValue(undefined),
    };
    const employeesCol = {
      doc: vi.fn().mockReturnValue(employeesColDocRef),
    };
    const auditCol = {
      doc: vi.fn().mockReturnValue(auditColDocRef),
    };
    const companyDocRef = {
      collection: vi.fn((name: string) => (name === 'audit' ? auditCol : employeesCol)),
    };
    const tx = {
      get: (ref: { get: () => Promise<unknown> }) => ref.get(),
      set: (ref: { set: (v: unknown) => unknown }, v: unknown) => ref.set(v),
      update: (ref: { update: (v: unknown) => unknown }, v: unknown) => ref.update(v),
    };
    const db = {
      collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(companyDocRef) }),
      runTransaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    } as unknown as Firestore;

    const result = await createEmployee(
      db,
      { ...validInput, name: 'María López', email: 'maria@co.com', role: 'middleManagement' },
      'authoritative-company-id',
      'actor-uid'
    );

    expect(result.id).toBe('new-emp-123');
    expect(db.collection).toHaveBeenCalledWith('companies');
    const docCall = (db.collection as ReturnType<typeof vi.fn>).mock.results[0].value.doc;
    expect(docCall).toHaveBeenCalledWith('authoritative-company-id');
    expect(employeesColDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'María López',
        email: 'maria@co.com',
        role: 'middleManagement',
        createdBy: 'actor-uid',
      })
    );
    expect(auditColDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'employee.created', actorUid: 'actor-uid' })
    );
  });
});

// ─── archiveEmployee ──────────────────────────────────────────────────────────

describe('archiveEmployee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets archived: true on the employee document', async () => {
    const { db, docRef } = makeDocFirestore('emp-1', true, validEmployeeData());
    await archiveEmployee(db, 'emp-1', 'cmp-1', 'actor-uid');
    expect(docRef.update).toHaveBeenCalledWith({ archived: true });
  });

  it('throws when employee does not exist in the company (cross-company guard)', async () => {
    const { db } = makeDocFirestore('emp-1', false, null);
    await expect(archiveEmployee(db, 'emp-1', 'cmp-wrong', 'actor-uid')).rejects.toThrow(/not found/);
  });
});
