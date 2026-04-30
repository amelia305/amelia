import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

// ─── Mock Firebase ────────────────────────────────────────────────────────────
const { mockAdminDb } = vi.hoisted(() => ({
  mockAdminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('$lib/server/firebase', () => ({
  adminDb: mockAdminDb,
}));

// ─── Mock employees module ────────────────────────────────────────────────────
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

describe('reportes/+page.server.ts load', () => {
  const mockDepends = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads latestIsme and latestCompletedAt directly from employee rows without assessment collection calls', async () => {
    const mockTimestamp = Timestamp.now();
    mockListEmployeesForCompany.mockResolvedValue([
      {
        id: 'emp-1',
        name: 'John Doe',
        email: 'john@company.com',
        role: 'executive',
        activeToken: undefined,
        archived: false,
        latestAssessmentId: 'asmt-1',
        latestIsme: 68,
        latestCompletedAt: mockTimestamp,
      },
      {
        id: 'emp-2',
        name: 'Jane Smith',
        email: 'jane@company.com',
        role: 'middleManagement',
        activeToken: undefined,
        archived: false,
        latestAssessmentId: 'asmt-2',
        latestIsme: 75,
        latestCompletedAt: mockTimestamp,
      },
    ]);

    const result = await load({
      locals: makeAdminLocals(['cmp-1']),
      depends: mockDepends,
    } as unknown as Parameters<typeof load>[0]);

    const rows = await (result as unknown as { rows: Promise<Array<Record<string, unknown>>> }).rows;

    // Verify rows are built directly from employee rows without additional assessment reads
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: 'emp-1',
      name: 'John Doe',
      email: 'john@company.com',
      role: 'executive',
      latestIsme: 68,
      latestCompletedAt: mockTimestamp,
    });
    expect(rows[1]).toEqual({
      id: 'emp-2',
      name: 'Jane Smith',
      email: 'jane@company.com',
      role: 'middleManagement',
      latestIsme: 75,
      latestCompletedAt: mockTimestamp,
    });

    // Verify that adminDb.collection was NOT called (no assessment collection reads)
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
  });

  it('handles denorm fields when latestIsme is null for unassessed employees', async () => {
    mockListEmployeesForCompany.mockResolvedValue([
      {
        id: 'emp-unassessed',
        name: 'Unassessed Employee',
        email: 'unassessed@company.com',
        role: 'operational',
        activeToken: undefined,
        archived: false,
        latestAssessmentId: undefined,
        latestIsme: null,
        latestCompletedAt: null,
      },
    ]);

    const result = await load({
      locals: makeAdminLocals(['cmp-1']),
      depends: mockDepends,
    } as unknown as Parameters<typeof load>[0]);

    const rows = await (result as unknown as { rows: Promise<Array<Record<string, unknown>>> }).rows;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: 'emp-unassessed',
      name: 'Unassessed Employee',
      email: 'unassessed@company.com',
      role: 'operational',
      latestIsme: null,
      latestCompletedAt: null,
    });
  });

  it('returns empty array when admin has no companyIds', async () => {
    const result = await load({
      locals: makeAdminLocals([]),
      depends: mockDepends,
    } as unknown as Parameters<typeof load>[0]);

    const rows = await (result as unknown as { rows: Promise<Array<Record<string, unknown>>> }).rows;

    expect(rows).toEqual([]);
    expect(mockListEmployeesForCompany).not.toHaveBeenCalled();
  });

  it('aggregates employees from multiple companies for adminEmpresa with multiple companyIds', async () => {
    const mockTimestamp = Timestamp.now();
    mockListEmployeesForCompany
      .mockResolvedValueOnce([
        {
          id: 'emp-cmp1',
          name: 'Employee in Company 1',
          email: 'emp1@cmp1.com',
          role: 'executive',
          activeToken: undefined,
          archived: false,
          latestAssessmentId: 'asmt-1',
          latestIsme: 72,
          latestCompletedAt: mockTimestamp,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'emp-cmp2',
          name: 'Employee in Company 2',
          email: 'emp2@cmp2.com',
          role: 'middleManagement',
          activeToken: undefined,
          archived: false,
          latestAssessmentId: 'asmt-2',
          latestIsme: 65,
          latestCompletedAt: mockTimestamp,
        },
      ]);

    const result = await load({
      locals: makeAdminLocals(['cmp-1', 'cmp-2']),
      depends: mockDepends,
    } as unknown as Parameters<typeof load>[0]);

    const rows = await (result as unknown as { rows: Promise<Array<Record<string, unknown>>> }).rows;

    expect(rows).toHaveLength(2);
    expect(mockListEmployeesForCompany).toHaveBeenCalledTimes(2);
    expect(mockListEmployeesForCompany).toHaveBeenNthCalledWith(1, mockAdminDb, 'cmp-1');
    expect(mockListEmployeesForCompany).toHaveBeenNthCalledWith(2, mockAdminDb, 'cmp-2');

    expect(rows[0].latestIsme).toBe(72);
    expect(rows[1].latestIsme).toBe(65);
  });

  it('throws 403 for non-adminEmpresa role', async () => {
    let thrownStatus: number | undefined;
    try {
      await load({
        locals: {
          user: {
            uid: 'u1',
            email: 'user@co.com',
            role: 'socio',
            companyIds: ['cmp-1'],
          },
        },
        depends: mockDepends,
      } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(403);
  });

  it('calls depends with app:employees for revalidation', async () => {
    mockListEmployeesForCompany.mockResolvedValue([]);

    await load({
      locals: makeAdminLocals(['cmp-1']),
      depends: mockDepends,
    } as unknown as Parameters<typeof load>[0]);

    expect(mockDepends).toHaveBeenCalledWith('app:employees');
  });
});
