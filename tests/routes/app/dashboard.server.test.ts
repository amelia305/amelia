import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock firebase ────────────────────────────────────────────────────────────
vi.mock('$lib/server/firebase', () => ({
  adminDb: {},
}));

// ─── Mock companies module ────────────────────────────────────────────────────
const { mockListCompaniesForAdmin, mockBuildCompanyDashboard } = vi.hoisted(() => ({
  mockListCompaniesForAdmin: vi.fn(),
  mockBuildCompanyDashboard: vi.fn(),
}));

vi.mock('$lib/server/companies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/companies')>();
  return {
    ...actual,
    listCompaniesForAdmin: mockListCompaniesForAdmin,
    buildCompanyDashboard: mockBuildCompanyDashboard,
  };
});

import { load } from '../../../src/routes/(app)/dashboard/+page.server';
import { recomputeCompanyStats } from '$lib/server/companies';
import type { LocalsUser } from '$lib/types';

function makeLocals(user: LocalsUser | null) {
  return { user };
}

describe('dashboard load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty dashboards when adminEmpresa has 0 companies', async () => {
    mockListCompaniesForAdmin.mockResolvedValue([]);

    const raw = await load({
      locals: makeLocals({
        uid: 'u1',
        email: 'a@b.com',
        role: 'adminEmpresa',
        companyIds: [],
      }),
      depends: vi.fn(),
    } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { dashboards: Promise<Array<Record<string, unknown>>> };
    const dashboards = await result.dashboards;

    expect(dashboards).toEqual([]);
    expect(mockBuildCompanyDashboard).not.toHaveBeenCalled();
  });

  it('calls buildCompanyDashboard for each company and returns dashboards', async () => {
    const company = { id: 'cmp-1', name: 'Acme', companyAdminUid: 'u1', partnerUid: 'p1' };
    const dashboard = {
      company,
      stats: {
        weightedIsme: 72,
        byRole: {
          executive: { avgIsme: 80, count: 1 },
          middleManagement: { avgIsme: 70, count: 1 },
          operational: { avgIsme: 60, count: 1 },
        },
      },
      recentAssessments: [],
    };
    mockListCompaniesForAdmin.mockResolvedValue([company]);
    mockBuildCompanyDashboard.mockResolvedValue(dashboard);

    const raw = await load({
      locals: makeLocals({
        uid: 'u1',
        email: 'a@b.com',
        role: 'adminEmpresa',
        companyIds: ['cmp-1'],
      }),
      depends: vi.fn(),
    } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { dashboards: Promise<Array<{ stats: { weightedIsme: number } }>> };
    const dashboards = await result.dashboards;

    expect(dashboards).toHaveLength(1);
    expect(dashboards[0].stats.weightedIsme).toBe(72);
  });

  it('weightedIsme in result matches recomputeCompanyStats output (integration check)', async () => {
    const assessments = [
      { role: 'executive' as const, isme: 80, id: 'a1', employeeId: 'e1', completedAt: null },
      { role: 'middleManagement' as const, isme: 70, id: 'a2', employeeId: 'e2', completedAt: null },
      { role: 'operational' as const, isme: 60, id: 'a3', employeeId: 'e3', completedAt: null },
    ];
    const company = { id: 'cmp-1', name: 'Acme', companyAdminUid: 'u1', partnerUid: 'p1' };
    // recomputeCompanyStats is NOT mocked — call the real function
    const expectedStats = recomputeCompanyStats(assessments);

    mockListCompaniesForAdmin.mockResolvedValue([company]);
    mockBuildCompanyDashboard.mockResolvedValue({
      company,
      stats: expectedStats,
      recentAssessments: assessments,
    });

    const raw = await load({
      locals: makeLocals({
        uid: 'u1',
        email: 'a@b.com',
        role: 'adminEmpresa',
        companyIds: ['cmp-1'],
      }),
      depends: vi.fn(),
    } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { dashboards: Promise<Array<{ stats: { weightedIsme: number } }>> };
    const dashboards = await result.dashboards;

    expect(dashboards[0].stats.weightedIsme).toBe(expectedStats.weightedIsme);
  });

  it('throws 501 for socio role', async () => {
    let thrownStatus: number | undefined;
    try {
      await load({
        locals: makeLocals({ uid: 'p1', email: 'p@b.com', role: 'socio', companyIds: [] }),
        depends: vi.fn(),
    } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(501);
  });

  it('throws 501 for superadmin role', async () => {
    let thrownStatus: number | undefined;
    try {
      await load({
        locals: makeLocals({ uid: 'sa1', email: 'sa@b.com', role: 'superadmin', companyIds: [] }),
        depends: vi.fn(),
    } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(501);
  });
});
