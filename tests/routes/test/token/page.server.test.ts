import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Timestamp } from 'firebase-admin/firestore';

// ─── Module mocks (must be at top level, outside describe) ───────────────────

vi.mock('$lib/server/firebase', () => ({
  adminDb: {},
}));

vi.mock('$lib/server/tokens', () => ({
  readActiveToken: vi.fn(),
  saveInProgressAnswers: vi.fn(),
}));

vi.mock('$lib/server/assessments', () => ({
  submitAssessment: vi.fn(),
}));

vi.mock('$lib/instrument/seed', () => ({
  getQuestions: vi.fn(() => []),
  PILLAR_NAMES: {
    executive: { 1: 'Resiliencia', 2: 'V', 3: 'S', 4: 'C', 5: 'P', 6: 'L' },
    middleManagement: { 1: 'Resiliencia', 2: 'V', 3: 'S', 4: 'C', 5: 'P', 6: 'L' },
    operational: { 1: 'Resiliencia', 2: 'S', 3: 'So', 4: 'C', 5: 'B', 6: 'A' },
  },
  PILLAR_INTROS: {
    executive: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
    middleManagement: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
    operational: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
  },
}));

// Import after mocks are registered
import { load, actions } from '../../../../src/routes/test/[token]/+page.server';
import { readActiveToken, saveInProgressAnswers } from '$lib/server/tokens';
import { submitAssessment } from '$lib/server/assessments';
import { getQuestions } from '$lib/instrument/seed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLoadEvent(token: string) {
  return {
    params: { token },
  } as Parameters<typeof load>[0];
}

function makeMockTimestamp(ms: number): Timestamp {
  return { toMillis: () => ms } as unknown as Timestamp;
}

function pendingTokenValue(overrides: Record<string, unknown> = {}) {
  return {
    companyId: 'company-1',
    employeeId: 'employee-1',
    role: 'executive' as const,
    status: 'pending' as const,
    createdAt: makeMockTimestamp(Date.now() - 1000),
    expiresAt: makeMockTimestamp(Date.now() + 86_400_000),
    partialAnswers: undefined,
    ...overrides,
  };
}

// Use application/x-www-form-urlencoded so request.formData() parses without error.
function makeFormDataRequest(answers: unknown): Request {
  const body = new URLSearchParams({ answers: JSON.stringify(answers) });
  return new Request('http://localhost/test/tok', {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

function makeSaveProgressRequest(pillar: number, answers: unknown): Request {
  const body = new URLSearchParams({ payload: JSON.stringify({ pillar, answers }) });
  return new Request('http://localhost/test/tok', {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

function makeNoPayloadRequest(): Request {
  const body = new URLSearchParams();
  return new Request('http://localhost/test/tok', {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

function makeNoAnswersRequest(): Request {
  const body = new URLSearchParams();
  return new Request('http://localhost/test/tok', {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

function makeActionEvent(token: string, request: Request) {
  return {
    params: { token },
    request,
  } as Parameters<typeof actions['saveProgress']>[0];
}

function make42Answers() {
  return Array.from({ length: 42 }, (_, i) => ({
    questionId: `executive-p${Math.floor(i / 7) + 1}-q${(i % 7) + 1}`,
    value: (((i % 5) + 1) as 1 | 2 | 3 | 4 | 5),
  }));
}

// ─── load ─────────────────────────────────────────────────────────────────────

describe('load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tokenValue, role, questions, pillarNames, and empty partialAnswers for a valid pending token', async () => {
    const tokenData = pendingTokenValue();
    vi.mocked(readActiveToken).mockResolvedValue({
      ok: true,
      value: { ref: {} as never, data: tokenData },
    });
    vi.mocked(getQuestions).mockReturnValue([]);

    const result = await load(makeLoadEvent('tok-abc'));
    if (!result) throw new Error('expected load to return data');

    expect(result.tokenValue).toBe('tok-abc');
    expect(result.role).toBe('executive');
    expect(result.partialAnswers).toEqual([]);
  });

  it('returns partialAnswers from token when token is inProgress', async () => {
    const partial = [{ questionId: 'executive-p1-q1', value: 3 as const }];
    const tokenData = pendingTokenValue({ status: 'inProgress', partialAnswers: partial });
    vi.mocked(readActiveToken).mockResolvedValue({
      ok: true,
      value: { ref: {} as never, data: tokenData },
    });

    const result = await load(makeLoadEvent('tok-partial'));
    if (!result) throw new Error('expected load to return data');

    expect(result.partialAnswers).toEqual(partial);
  });

  it('throws 404 error when token is not found', async () => {
    vi.mocked(readActiveToken).mockResolvedValue({
      ok: false,
      status: 404,
      message: 'Token not found',
    });

    await expect(load(makeLoadEvent('missing'))).rejects.toMatchObject({ status: 404 });
  });

  it('throws 410 error when token is expired or completed', async () => {
    vi.mocked(readActiveToken).mockResolvedValue({
      ok: false,
      status: 410,
      message: 'Token is expired',
    });

    await expect(load(makeLoadEvent('old-tok'))).rejects.toMatchObject({ status: 410 });
  });

  it('throws 500 error when token schema is invalid', async () => {
    vi.mocked(readActiveToken).mockResolvedValue({
      ok: false,
      status: 500,
      message: 'Schema mismatch',
    });

    await expect(load(makeLoadEvent('bad-tok'))).rejects.toMatchObject({ status: 500 });
  });
});

// ─── actions.saveProgress ─────────────────────────────────────────────────────

describe('actions.saveProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { ok: true } for a valid pillar-scoped payload', async () => {
    vi.mocked(saveInProgressAnswers).mockResolvedValue({ ok: true, value: undefined });

    const answers = Array.from({ length: 7 }, (_, i) => ({
      questionId: `executive-p1-q${i + 1}`,
      value: 3 as const,
    }));
    const result = await actions.saveProgress(
      makeActionEvent('tok-abc', makeSaveProgressRequest(1, answers))
    );

    expect(result).toEqual({ ok: true });
    expect(saveInProgressAnswers).toHaveBeenCalledWith(
      {},
      'tok-abc',
      1,
      expect.arrayContaining([expect.objectContaining({ questionId: 'executive-p1-q1' })])
    );
  });

  it('returns fail(400) when payload field is missing', async () => {
    const result = await actions.saveProgress(
      makeActionEvent('tok-abc', makeNoPayloadRequest())
    );
    expect(result).toMatchObject({ status: 400 });
  });

  it('throws SyntaxError when payload JSON is malformed (preprocess propagates)', async () => {
    const body = new URLSearchParams({ payload: 'not-json' });
    const req = new Request('http://localhost/test/tok', {
      method: 'POST',
      body: body.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    await expect(
      actions.saveProgress(makeActionEvent('tok-abc', req))
    ).rejects.toThrow(SyntaxError);
  });

  it('returns fail(400) when answer value is out of range (6 is invalid)', async () => {
    const answers = [{ questionId: 'executive-p1-q1', value: 6 }];
    const result = await actions.saveProgress(
      makeActionEvent('tok-abc', makeSaveProgressRequest(1, answers))
    );
    expect(result).toMatchObject({ status: 400 });
  });

  it('returns fail(400) when answers contain questionIds from a different pillar (pillar_mismatch)', async () => {
    // pillar=1 but questionIds reference p2 — refine should reject
    const answers = Array.from({ length: 7 }, (_, i) => ({
      questionId: `executive-p2-q${i + 1}`,
      value: 3 as const,
    }));
    const result = await actions.saveProgress(
      makeActionEvent('tok-abc', makeSaveProgressRequest(1, answers))
    );
    expect(result).toMatchObject({ status: 400 });
  });

  it('returns fail(400) when answers array exceeds 7 items', async () => {
    const answers = Array.from({ length: 8 }, (_, i) => ({
      questionId: `executive-p1-q${i + 1}`,
      value: 3 as const,
    }));
    const result = await actions.saveProgress(
      makeActionEvent('tok-abc', makeSaveProgressRequest(1, answers))
    );
    expect(result).toMatchObject({ status: 400 });
  });
});

// ─── actions.submitTest ───────────────────────────────────────────────────────

describe('actions.submitTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fail(400) when answers has fewer than 42 items', async () => {
    const answers = [{ questionId: 'q1', value: 3 }];
    const result = await actions.submitTest(
      makeActionEvent('tok-abc', makeFormDataRequest(answers))
    );
    expect(result).toMatchObject({ status: 400 });
  });

  it('returns fail(400) when answers field is missing', async () => {
    const result = await actions.submitTest(
      makeActionEvent('tok-abc', makeNoAnswersRequest())
    );
    expect(result).toMatchObject({ status: 400 });
  });

  it('calls submitAssessment and redirects 303 to /test/thank-you on happy path', async () => {
    const tokenData = pendingTokenValue();
    vi.mocked(readActiveToken).mockResolvedValue({
      ok: true,
      value: { ref: {} as never, data: tokenData },
    });
    vi.mocked(submitAssessment).mockResolvedValue({ assessmentId: 'assessment-123' });

    // SvelteKit redirect throws a Redirect object; rejects.toMatchObject checks shape
    await expect(
      actions.submitTest(makeActionEvent('tok-abc', makeFormDataRequest(make42Answers())))
    ).rejects.toMatchObject({ status: 303, location: '/test/thank-you' });

    expect(submitAssessment).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        tokenValue: 'tok-abc',
        companyId: 'company-1',
        employeeId: 'employee-1',
        role: 'executive',
      })
    );
  });

  it('throws 410 when readActiveToken returns expired during submit', async () => {
    vi.mocked(readActiveToken).mockResolvedValue({
      ok: false,
      status: 410,
      message: 'Token is expired',
    });

    await expect(
      actions.submitTest(makeActionEvent('tok-abc', makeFormDataRequest(make42Answers())))
    ).rejects.toMatchObject({ status: 410 });
  });

  it('propagates an error from submitAssessment when token is already completed', async () => {
    const tokenData = pendingTokenValue();
    vi.mocked(readActiveToken).mockResolvedValue({
      ok: true,
      value: { ref: {} as never, data: tokenData },
    });
    // submitAssessment throws a plain Error (same propagation path as HttpError).
    const alreadyCompleted = new Error('ALREADY_COMPLETED');
    vi.mocked(submitAssessment).mockRejectedValue(alreadyCompleted);

    await expect(
      actions.submitTest(makeActionEvent('tok-abc', makeFormDataRequest(make42Answers())))
    ).rejects.toThrow('ALREADY_COMPLETED');
  });
});
