import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock firebase ────────────────────────────────────────────────────────────
const { mockAdminDb } = vi.hoisted(() => ({
  mockAdminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('$lib/server/firebase', () => ({
  adminDb: mockAdminDb,
}));

// ─── Mock employees module ────────────────────────────────────────────────────
const { mockGetEmployee } = vi.hoisted(() => ({
  mockGetEmployee: vi.fn(),
}));

vi.mock('$lib/server/employees', () => ({
  getEmployee: mockGetEmployee,
}));

// ─── Mock instrument seed ─────────────────────────────────────────────────────
const { mockGetQuestions } = vi.hoisted(() => ({
  mockGetQuestions: vi.fn(),
}));

vi.mock('$lib/instrument/seed', () => ({
  getQuestions: mockGetQuestions,
}));

import { load } from '../../../src/routes/(app)/reportes/[employeeId]/+page.server';
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

function makeAssessmentSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  };
}

function setupAdminDbChain(snap: ReturnType<typeof makeAssessmentSnap>) {
  const assessmentsCol = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(snap),
  };
  const companyDocRef = {
    collection: vi.fn().mockReturnValue(assessmentsCol),
  };
  mockAdminDb.collection.mockReturnValue({
    doc: vi.fn().mockReturnValue(companyDocRef),
  });
}

const mockEmployee = {
  id: 'emp-1',
  name: 'Juan',
  email: 'juan@co.com',
  role: 'executive' as const,
  nationalId: '123',
  birthDate: '1990-01-01',
  gender: 'M',
  tenureMonths: 12,
  archived: false,
};

// ─── load ─────────────────────────────────────────────────────────────────────

describe('reportes/[employeeId] load', () => {
  const mockDepends = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDepends.mockClear();
  });

  it('throws 403 when adminEmpresa has no companyIds', async () => {
    let thrownStatus: number | undefined;
    try {
      await load({
        locals: makeAdminLocals([]),
        params: { employeeId: 'emp-1' },
        depends: mockDepends,
      } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(403);
  });

  it('throws 403 for non-adminEmpresa role', async () => {
    mockDepends.mockClear();
    let thrownStatus: number | undefined;
    try {
      await load({
        locals: { user: { uid: 'p1', email: 'p@b.com', role: 'socio', companyIds: ['cmp-1'] } },
        params: { employeeId: 'emp-1' },
        depends: mockDepends,
      } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(403);
  });

  it('throws 404 when employee not found', async () => {
    mockDepends.mockClear();
    mockGetEmployee.mockResolvedValue(null);
    setupAdminDbChain(makeAssessmentSnap([]));

    let thrownStatus: number | undefined;
    try {
      await load({
        locals: makeAdminLocals(['cmp-1']),
        params: { employeeId: 'emp-missing' },
        depends: mockDepends,
      } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(404);
  });

  it('joins answers with question text from getQuestions', async () => {
    mockGetEmployee.mockResolvedValue(mockEmployee);
    mockGetQuestions.mockReturnValue([
      { id: 'executive-p1-q1', pillar: 1, text: 'Question text here', reverse: false },
    ]);
    const mockDate = { toDate: () => new Date('2024-01-01') };
    setupAdminDbChain(makeAssessmentSnap([
      {
        id: 'asmt-1',
        data: {
          employeeId: 'emp-1',
          role: 'executive',
          isme: 75,
          scoresByPillar: { p1: 80, p2: 70, p3: 60, p4: 75, p5: 65, p6: 70 },
          completedAt: mockDate,
          instrumentVersion: 1,
          answers: [{ questionId: 'executive-p1-q1', value: 4 }],
        },
      },
    ]));

    const raw = await load({
      locals: makeAdminLocals(['cmp-1']),
      params: { employeeId: 'emp-1' },
      depends: mockDepends,
    } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as {
      employee: { id: string };
      assessments: Array<{ answers: Array<{ text: string; value: number; questionId: string }> }>;
    };

    expect(result.employee.id).toBe('emp-1');
    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0].answers).toHaveLength(1);
    expect(result.assessments[0].answers[0].text).toBe('Question text here');
    expect(result.assessments[0].answers[0].value).toBe(4);
    expect(mockGetQuestions).toHaveBeenCalledWith('executive');
  });

  it('skips answers whose questionId has no matching question', async () => {
    mockGetEmployee.mockResolvedValue(mockEmployee);
    mockGetQuestions.mockReturnValue([
      { id: 'executive-p1-q1', pillar: 1, text: 'Known question', reverse: false },
    ]);
    const mockDate = { toDate: () => new Date('2024-01-01') };
    setupAdminDbChain(makeAssessmentSnap([
      {
        id: 'asmt-2',
        data: {
          employeeId: 'emp-1',
          role: 'executive',
          isme: 60,
          scoresByPillar: { p1: 60, p2: 60, p3: 60, p4: 60, p5: 60, p6: 60 },
          completedAt: mockDate,
          instrumentVersion: 1,
          answers: [
            { questionId: 'executive-p1-q1', value: 3 },
            { questionId: 'unknown-question', value: 5 },
          ],
        },
      },
    ]));

    const raw = await load({
      locals: makeAdminLocals(['cmp-1']),
      params: { employeeId: 'emp-1' },
      depends: mockDepends,
    } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as {
      assessments: Array<{ answers: Array<{ questionId: string }> }>;
    };

    expect(result.assessments[0].answers).toHaveLength(1);
    expect(result.assessments[0].answers[0].questionId).toBe('executive-p1-q1');
  });

  describe('parallel load', () => {
    it('runs getEmployee and assessments snap query concurrently with total elapsed < 30ms', async () => {
      const delayMs = 10;
      mockGetEmployee.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockEmployee), delayMs);
          })
      );

      const mockDate = { toDate: () => new Date('2024-01-01') };
      const delayedSnap = makeAssessmentSnap([
        {
          id: 'asmt-1',
          data: {
            employeeId: 'emp-1',
            role: 'executive',
            isme: 75,
            scoresByPillar: { p1: 80, p2: 70, p3: 60, p4: 75, p5: 65, p6: 70 },
            completedAt: mockDate,
            instrumentVersion: 1,
            answers: [],
          },
        },
      ]);

      // Setup the mock chain to resolve with delay
      const assessmentsCol = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(delayedSnap), delayMs);
            })
        ),
      };
      const companyDocRef = {
        collection: vi.fn().mockReturnValue(assessmentsCol),
      };
      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(companyDocRef),
      });

      mockGetQuestions.mockReturnValue([]);

      const startTime = performance.now();
      await load({
        locals: makeAdminLocals(['cmp-1']),
        params: { employeeId: 'emp-1' },
        depends: mockDepends,
      } as unknown as Parameters<typeof load>[0]);
      const elapsedMs = performance.now() - startTime;

      expect(mockGetEmployee).toHaveBeenCalledTimes(1);
      expect(elapsedMs).toBeLessThan(30);
    });
  });
});
