import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// ─── Mock Firebase ────────────────────────────────────────────────────────────

vi.mock('$lib/server/firebase');
vi.mock('$lib/instrument/seed', () => ({
  getQuestions: vi.fn(() => [
    {
      id: 'q1',
      pillar: 1,
      text: 'Question 1',
      reverse: false,
    },
  ]),
  INSTRUMENT_VERSION: 1,
}));
vi.mock('$lib/server/scoring', () => ({
  scoreAnswers: vi.fn(() => ({
    scoresByPillar: { p1: 80, p2: 75, p3: 70, p4: 85, p5: 78, p6: 72 },
    total: 460,
  })),
  calculateIsme: vi.fn((total) => {
    // Simple mock: isqe = total / 6
    return Math.round((total / 480) * 100);
  }),
  computeCompanyStats: vi.fn(() => ({
    weightedIsme: 75,
    byRole: {
      executive: { count: 1, avgIsme: 75 },
      middleManagement: { count: 0, avgIsme: 0 },
      operational: { count: 0, avgIsme: 0 },
    },
    updatedAt: Timestamp.now(),
  })),
}));
vi.mock('$lib/server/tokens', () => ({
  markTokenCompleted: vi.fn(),
}));

import { submitAssessment as submitAssessmentImpl } from '$lib/server/assessments';

describe('submitAssessment denormalization', () => {
  let mockDb: Firestore;
  let mockTransaction: Transaction;
  let mockRunTransaction: ReturnType<typeof vi.fn<[(tx: Transaction) => Promise<unknown>], Promise<unknown>>>;
  let mockSet: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSet = vi.fn();
    mockUpdate = vi.fn();
    mockGet = vi.fn();

    mockTransaction = {
      set: mockSet,
      update: mockUpdate,
      get: mockGet,
    } as unknown as Transaction;

    mockRunTransaction = vi.fn((callback) =>
      (callback as (tx: Transaction) => Promise<unknown>)(mockTransaction)
    );

    mockDb = {
      collection: vi.fn(),
      runTransaction: mockRunTransaction,
    } as unknown as Firestore;

    // Setup the default mock chains
    const mockDocRef = {
      id: 'asmt-new-id',
    };

    const mockEmployeeRef = {};
    const mockTokenRef = {};
    const mockAssessmentsCol = {
      doc: vi.fn(() => mockDocRef),
    };
    const mockAuditCol = {
      doc: vi.fn(() => ({})),
    };
    const mockCompanyRef = {
      collection: vi.fn((colName) => {
        if (colName === 'assessments') return mockAssessmentsCol;
        if (colName === 'audit') return mockAuditCol;
        if (colName === 'employees') {
          return { doc: vi.fn(() => mockEmployeeRef) };
        }
        return {};
      }),
    };

    (mockDb.collection as ReturnType<typeof vi.fn>).mockImplementation((colName) => {
      if (colName === 'tokens') {
        return { doc: vi.fn(() => mockTokenRef) };
      }
      if (colName === 'companies') {
        return { doc: vi.fn(() => mockCompanyRef) };
      }
      return {};
    });

    // Mock the transaction.get calls for token and company
    mockGet.mockImplementation((ref) => {
      if (ref === mockTokenRef) {
        return Promise.resolve({
          data: () => ({
            status: 'pending',
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 86400000)), // 1 day from now
          }),
        });
      }
      if (ref === mockCompanyRef) {
        return Promise.resolve({
          data: () => ({
            stats: {
              weightedIsme: 70,
              byRole: {
                executive: { count: 0, avgIsme: 0 },
                middleManagement: { count: 0, avgIsme: 0 },
                operational: { count: 0, avgIsme: 0 },
              },
            },
          }),
        });
      }
      return Promise.resolve({});
    });
  });

  it('writes latestIsme and latestCompletedAt to employee doc in the transaction', async () => {
    const args = {
      tokenValue: 'token-123',
      companyId: 'cmp-1',
      employeeId: 'emp-1',
      role: 'executive' as const,
      answers: [{ questionId: 'q1', value: 4 as const }],
    };

    await submitAssessmentImpl(mockDb, args);

    // Verify that the employee update includes latestIsme and latestCompletedAt
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        latestAssessmentId: expect.any(String),
        latestIsme: expect.any(Number),
        latestCompletedAt: expect.any(Timestamp),
        activeToken: FieldValue.delete(),
      })
    );

    // Verify the second update call is for company ref
    const calls = mockUpdate.mock.calls;
    const employeeUpdateCall = calls[0];
    const updatePayload = employeeUpdateCall[1];

    expect(updatePayload.latestIsme).toBeGreaterThanOrEqual(0);
    expect(updatePayload.latestIsme).toBeLessThanOrEqual(100);
    expect(updatePayload.latestCompletedAt).toBeInstanceOf(Timestamp);
  });

  it('includes latestAssessmentId alongside latestIsme in the employee update', async () => {
    const args = {
      tokenValue: 'token-456',
      companyId: 'cmp-1',
      employeeId: 'emp-2',
      role: 'middleManagement' as const,
      answers: [{ questionId: 'q1', value: 3 as const }],
    };

    await submitAssessmentImpl(mockDb, args);

    expect(mockUpdate).toHaveBeenCalled();
    const updatePayload = mockUpdate.mock.calls[0][1];

    // All three denorm fields should be present
    expect(updatePayload).toHaveProperty('latestAssessmentId');
    expect(updatePayload).toHaveProperty('latestIsme');
    expect(updatePayload).toHaveProperty('latestCompletedAt');
    expect(updatePayload).toHaveProperty('activeToken', FieldValue.delete());
  });
});
