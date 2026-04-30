import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Configurable adminDb mock ────────────────────────────────────────────────
const { mockDb } = vi.hoisted(() => ({
  mockDb: { collection: vi.fn() },
}));

vi.mock('$lib/server/firebase', () => ({
  adminDb: mockDb,
}));

// ─── Mock employees ───────────────────────────────────────────────────────────
const { mockListEmployeesForCompany } = vi.hoisted(() => ({
  mockListEmployeesForCompany: vi.fn(),
}));

vi.mock('$lib/server/employees', () => ({
  listEmployeesForCompany: mockListEmployeesForCompany,
}));

import { load } from '../../../src/routes/(app)/reportes/+page.server';
import type { LocalsUser } from '$lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAdminLocals(companyIds: string[] = ['cmp-1']): { user: LocalsUser } {
  return {
    user: {
      uid: 'u1',
      email: 'admin@co.com',
      role: 'adminEmpresa',
      companyIds,
    },
  };
}

/**
 * Configures mockDb.collection to support point reads on
 * companies/{cId}/assessments/{aId}. Pass assessment data keyed by doc ID.
 * Calls to .orderBy().get() (full scan) are tracked via fullScanGet.
 */
function setupPointReadDb(
  assessments: Record<string, Record<string, unknown>> = {}
): { fullScanGet: ReturnType<typeof vi.fn> } {
  const fullScanGet = vi.fn().mockResolvedValue({ docs: [] });

  mockDb.collection.mockImplementation(() => ({
    doc: vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockImplementation((aId: string) => ({
          get: vi.fn().mockResolvedValue({
            exists: aId in assessments,
            data: () => assessments[aId] ?? null,
          }),
        })),
        orderBy: vi.fn().mockReturnValue({ get: fullScanGet }),
      }),
    }),
  }));

  return { fullScanGet };
}

// ─── reportes load ────────────────────────────────────────────────────────────

describe('reportes load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rows scoped to companyIds only', async () => {
    mockListEmployeesForCompany.mockResolvedValue([
      {
        id: 'emp-1',
        name: 'Ana',
        email: 'ana@co.com',
        role: 'executive',
        archived: false,
        latestIsme: null,
        latestCompletedAt: null,
      },
    ]);
    setupPointReadDb();

    const raw = await load({ locals: makeAdminLocals(['cmp-1']), depends: vi.fn() } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { rows: Promise<Array<{ id: string }>> };
    const rows = await result.rows;

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('emp-1');
    expect(mockListEmployeesForCompany).toHaveBeenCalledWith(expect.anything(), 'cmp-1');
  });

  it('returns empty rows when admin has no companyIds', async () => {
    const raw = await load({ locals: makeAdminLocals([]), depends: vi.fn() } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { rows: Promise<unknown[]> | unknown[] };
    const rows = await Promise.resolve(result.rows);

    expect(rows).toEqual([]);
    expect(mockListEmployeesForCompany).not.toHaveBeenCalled();
  });

  it('reads latestIsme directly from employee denorm field (no point read)', async () => {
    const { Timestamp } = await import('firebase-admin/firestore');
    const mockTimestamp = Timestamp.now();
    mockListEmployeesForCompany.mockResolvedValue([
      {
        id: 'emp-1',
        name: 'Ana',
        email: 'ana@co.com',
        role: 'executive',
        archived: false,
        latestAssessmentId: 'a1',
        latestIsme: 83,
        latestCompletedAt: mockTimestamp,
      },
    ]);
    setupPointReadDb({
      a1: { employeeId: 'emp-1', role: 'executive', isme: 83, completedAt: { toDate: () => new Date('2024-01-01') } },
    });

    const raw = await load({ locals: makeAdminLocals(['cmp-1']), depends: vi.fn() } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { rows: Promise<Array<{ latestIsme: number | null }>> };
    const rows = await result.rows;

    expect(rows[0].latestIsme).toBe(83);
  });

  it('sets latestIsme to null when employee has no latestAssessmentId', async () => {
    mockListEmployeesForCompany.mockResolvedValue([
      {
        id: 'emp-2',
        name: 'Bob',
        email: 'bob@co.com',
        role: 'operational',
        archived: false,
        latestIsme: null,
        latestCompletedAt: null,
      },
    ]);
    setupPointReadDb();

    const raw = await load({ locals: makeAdminLocals(['cmp-1']), depends: vi.fn() } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { rows: Promise<Array<{ latestIsme: number | null }>> };
    const rows = await result.rows;

    expect(rows[0].latestIsme).toBeNull();
  });

  it('does not perform any assessment collection reads after denormalization', async () => {
    const { Timestamp } = await import('firebase-admin/firestore');
    const mockTimestamp = Timestamp.now();
    mockListEmployeesForCompany.mockResolvedValue([
      {
        id: 'emp-1',
        name: 'Ana',
        email: 'ana@co.com',
        role: 'executive',
        archived: false,
        latestAssessmentId: 'a1',
        latestIsme: 75,
        latestCompletedAt: mockTimestamp,
      },
    ]);
    const { fullScanGet } = setupPointReadDb({
      a1: { employeeId: 'emp-1', role: 'executive', isme: 75, completedAt: { toDate: () => new Date() } },
    });

    const raw3 = await load({ locals: makeAdminLocals(['cmp-1']), depends: vi.fn() } as unknown as Parameters<typeof load>[0]);
    await (raw3 as unknown as { rows: Promise<unknown> }).rows;

    expect(fullScanGet).not.toHaveBeenCalled();
  });

  it('throws 403 for non-adminEmpresa role', async () => {
    let thrownStatus: number | undefined;
    try {
      await load({
        locals: { user: { uid: 'p1', email: 'p@b.com', role: 'socio', companyIds: [] } },
        depends: vi.fn(),
      } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(403);
  });
});
