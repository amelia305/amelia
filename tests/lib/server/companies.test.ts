import { describe, it, expect, vi } from 'vitest';
import {
  recomputeCompanyStats,
  listCompaniesForAdmin,
  listAssessmentsForCompany,
  listRecentAssessmentsForCompany,
  buildCompanyDashboard,
  type CompanyWithId,
} from '$lib/server/companies';
import { computeCompanyStats } from '$lib/server/scoring';
import type { Firestore } from 'firebase-admin/firestore';
import type { Role } from '$lib/types';

// ─── recomputeCompanyStats ────────────────────────────────────────────────────

describe('recomputeCompanyStats', () => {
  it('returns zeroed stats for empty assessments array', () => {
    const result = recomputeCompanyStats([]);
    expect(result.weightedIsme).toBe(0);
    expect(result.byRole.executive).toEqual({ avgIsme: 0, count: 0 });
    expect(result.byRole.middleManagement).toEqual({ avgIsme: 0, count: 0 });
    expect(result.byRole.operational).toEqual({ avgIsme: 0, count: 0 });
  });

  it('matches a manual reduce over computeCompanyStats for 3 assessments', () => {
    const assessments: Array<{ role: Role; isme: number }> = [
      { role: 'executive', isme: 80 },
      { role: 'middleManagement', isme: 70 },
      { role: 'operational', isme: 60 },
    ];

    const expected = assessments.reduce<ReturnType<typeof computeCompanyStats>>(
      (prev, a) => computeCompanyStats(prev, a),
      {
        weightedIsme: 0,
        byRole: {
          executive: { avgIsme: 0, count: 0 },
          middleManagement: { avgIsme: 0, count: 0 },
          operational: { avgIsme: 0, count: 0 },
        },
      }
    );

    const result = recomputeCompanyStats(assessments);
    expect(result.weightedIsme).toBe(expected.weightedIsme);
    expect(result.byRole.executive).toEqual(expected.byRole.executive);
    expect(result.byRole.middleManagement).toEqual(expected.byRole.middleManagement);
    expect(result.byRole.operational).toEqual(expected.byRole.operational);
  });

  it('handles single assessment correctly', () => {
    const result = recomputeCompanyStats([{ role: 'executive', isme: 75 }]);
    expect(result.byRole.executive.count).toBe(1);
    expect(result.byRole.executive.avgIsme).toBe(75);
    expect(result.byRole.middleManagement.count).toBe(0);
  });

  it('correctly averages multiple assessments for the same role', () => {
    const assessments: Array<{ role: Role; isme: number }> = [
      { role: 'executive', isme: 60 },
      { role: 'executive', isme: 80 },
    ];
    const result = recomputeCompanyStats(assessments);
    expect(result.byRole.executive.count).toBe(2);
    expect(result.byRole.executive.avgIsme).toBe(70);
  });
});

// ─── listCompaniesForAdmin ────────────────────────────────────────────────────

function makeCompanyDoc(id: string, data: Record<string, unknown>, exists = true) {
  return {
    id,
    exists,
    data: () => data,
  };
}

function makeFirestoreForCompanies(docs: ReturnType<typeof makeCompanyDoc>[]) {
  const docFn = vi.fn((id: string) => {
    const snap = docs.find((d) => d.id === id) ?? { id, exists: false, data: () => null };
    return { get: vi.fn().mockResolvedValue(snap) };
  });
  return {
    collection: vi.fn().mockReturnValue({ doc: docFn }),
  } as unknown as Firestore;
}

describe('listCompaniesForAdmin', () => {
  it('returns empty array for empty companyIds', async () => {
    const db = makeFirestoreForCompanies([]);
    const result = await listCompaniesForAdmin(db, []);
    expect(result).toEqual([]);
  });

  it('returns companies for valid companyIds', async () => {
    const db = makeFirestoreForCompanies([
      makeCompanyDoc('cmp-1', {
        name: 'Acme Corp',
        companyAdminUid: 'admin-1',
        partnerUid: 'partner-1',
        createdAt: {},
        createdBy: 'seed',
      }),
    ]);
    const result = await listCompaniesForAdmin(db, ['cmp-1']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cmp-1');
    expect(result[0].name).toBe('Acme Corp');
  });

  it('skips non-existent company IDs silently', async () => {
    const db = makeFirestoreForCompanies([
      makeCompanyDoc('missing', {}, false),
    ]);
    const result = await listCompaniesForAdmin(db, ['missing']);
    expect(result).toEqual([]);
  });
});

// ─── listAssessmentsForCompany ────────────────────────────────────────────────

function makeAssessmentFirestore(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const querySnap = {
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  };
  const companyDocRef = {
    collection: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(querySnap),
      }),
    }),
  };
  return {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue(companyDocRef),
    }),
  } as unknown as Firestore;
}

describe('listAssessmentsForCompany', () => {
  it('returns empty array when no assessments exist', async () => {
    const db = makeAssessmentFirestore([]);
    const result = await listAssessmentsForCompany(db, 'cmp-1');
    expect(result).toEqual([]);
  });

  it('returns parsed assessments', async () => {
    const db = makeAssessmentFirestore([
      {
        id: 'asmt-1',
        data: {
          employeeId: 'emp-1',
          role: 'executive',
          isme: 75,
          completedAt: { toDate: () => new Date('2024-01-01') },
        },
      },
    ]);
    const result = await listAssessmentsForCompany(db, 'cmp-1');
    expect(result).toHaveLength(1);
    expect(result[0].employeeId).toBe('emp-1');
    expect(result[0].isme).toBe(75);
    expect(result[0].role).toBe('executive');
  });

  it('skips docs that fail schema validation', async () => {
    const db = makeAssessmentFirestore([
      {
        id: 'bad-asmt',
        data: { role: 'INVALID', isme: 'not-a-number', completedAt: { toDate: () => new Date() } }, // invalid role + isme
      },
    ]);
    const result = await listAssessmentsForCompany(db, 'cmp-1');
    expect(result).toEqual([]);
  });
});

// ─── listRecentAssessmentsForCompany ─────────────────────────────────────────

function makeRecentAssessmentFirestore(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const querySnap = { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
  const limitFn = vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(querySnap) });
  const directGetFn = vi.fn().mockResolvedValue(querySnap);

  const orderByRef = { limit: limitFn, get: directGetFn };
  const companyDocRef = {
    collection: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue(orderByRef) }),
  };
  const db = {
    collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(companyDocRef) }),
  } as unknown as Firestore;

  return { db, limitFn, directGetFn };
}

describe('listRecentAssessmentsForCompany', () => {
  it('applies .limit(n) to the assessments query', async () => {
    const { db, limitFn } = makeRecentAssessmentFirestore([]);
    await listRecentAssessmentsForCompany(db, 'cmp-1', 5);
    expect(limitFn).toHaveBeenCalledWith(5);
  });

  it('returns the docs returned by the limited query', async () => {
    const ts = { toDate: () => new Date('2024-01-01') };
    const { db, limitFn } = makeRecentAssessmentFirestore([
      { id: 'a1', data: { employeeId: 'emp-1', role: 'executive', isme: 75, completedAt: ts } },
      { id: 'a2', data: { employeeId: 'emp-2', role: 'operational', isme: 60, completedAt: ts } },
    ]);
    const result = await listRecentAssessmentsForCompany(db, 'cmp-1', 10);
    expect(limitFn).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a1');
  });
});

// ─── buildCompanyDashboard ────────────────────────────────────────────────────

describe('buildCompanyDashboard (stats from company doc)', () => {
  const companyStats = {
    weightedIsme: 72,
    byRole: {
      executive: { avgIsme: 80, count: 2 },
      middleManagement: { avgIsme: 70, count: 3 },
      operational: { avgIsme: 65, count: 5 },
    },
  };

  it('reads stats from company.stats without performing a full assessment scan', async () => {
    const { db, limitFn, directGetFn } = makeRecentAssessmentFirestore([]);
    const company: CompanyWithId = {
      id: 'cmp-1', name: 'Test Corp', companyAdminUid: 'a1', partnerUid: 'p1',
      stats: companyStats,
    };
    const dashboard = await buildCompanyDashboard(db, company, 10);
    expect(dashboard.stats.weightedIsme).toBe(72);
    expect(limitFn).toHaveBeenCalledWith(10);
    expect(directGetFn).not.toHaveBeenCalled();
  });

  it('returns zeroed stats when company.stats is undefined', async () => {
    const { db } = makeRecentAssessmentFirestore([]);
    const company: CompanyWithId = {
      id: 'cmp-2', name: 'New Corp', companyAdminUid: 'a2', partnerUid: 'p2',
    };
    const dashboard = await buildCompanyDashboard(db, company, 10);
    expect(dashboard.stats.weightedIsme).toBe(0);
    expect(dashboard.stats.byRole.executive).toEqual({ avgIsme: 0, count: 0 });
    expect(dashboard.recentAssessments).toEqual([]);
  });

  it('passes recentLimit to listRecentAssessmentsForCompany', async () => {
    const { db, limitFn } = makeRecentAssessmentFirestore([]);
    const company: CompanyWithId = {
      id: 'cmp-3', name: 'Corp', companyAdminUid: 'a3', partnerUid: 'p3',
      stats: companyStats,
    };
    await buildCompanyDashboard(db, company, 5);
    expect(limitFn).toHaveBeenCalledWith(5);
  });
});
