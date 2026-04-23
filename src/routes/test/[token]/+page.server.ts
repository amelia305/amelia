import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { adminDb } from '$lib/server/firebase';
import { readActiveToken, saveInProgressAnswers } from '$lib/server/tokens';
import { submitAssessment } from '$lib/server/assessments';
import { getQuestions, PILLAR_NAMES } from '$lib/instrument/seed';
import { AnswerSchema } from '$lib/types';
import type { Role, Answer, Question } from '$lib/types';

const parseJsonString = (val: unknown): unknown => JSON.parse(String(val));

const PillarIndexSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const SaveProgressPayloadSchema = z
  .object({
    pillar: PillarIndexSchema,
    answers: AnswerSchema.array().max(7),
  })
  .refine(
    ({ pillar, answers }) => answers.every((a) => a.questionId.includes(`-p${pillar}-q`)),
    { message: 'pillar_mismatch' }
  );

const JsonSaveProgressSchema = z.preprocess(parseJsonString, SaveProgressPayloadSchema);

const JsonSubmitSchema = z.preprocess(parseJsonString, AnswerSchema.array().length(42));

interface LoadResult {
  tokenValue: string;
  role: Role;
  questions: readonly Question[];
  pillarNames: Record<1 | 2 | 3 | 4 | 5 | 6, string>;
  partialAnswers: Answer[];
}

export const load: PageServerLoad = async ({ params }): Promise<LoadResult> => {
  const result = await readActiveToken(adminDb, params.token);

  if (!result.ok) {
    if (result.status === 404) {
      error(404, 'Token de evaluación no encontrado.');
    }
    if (result.status === 410) {
      error(410, 'Este enlace ya fue utilizado o ha expirado.');
    }
    error(500, 'Error al verificar el token.');
  }

  const { data: token } = result.value;

  return {
    tokenValue: params.token,
    role: token.role,
    questions: getQuestions(token.role),
    pillarNames: PILLAR_NAMES[token.role],
    partialAnswers: token.partialAnswers ?? [],
  };
};

export const actions: Actions = {
  saveProgress: async ({ request, params }) => {
    const formData = await request.formData();
    const rawPayload = formData.get('payload');

    if (rawPayload === null) {
      return fail(400, { message: 'Missing payload field.' });
    }

    const parsed = JsonSaveProgressSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return fail(400, { message: 'Invalid payload format.' });
    }

    const { pillar, answers } = parsed.data;
    const result = await saveInProgressAnswers(adminDb, params.token, pillar, answers);
    if (!result.ok) {
      return fail(result.status, { message: result.message });
    }

    return { ok: true };
  },

  submitTest: async ({ request, params }) => {
    const formData = await request.formData();
    const rawAnswers = formData.get('answers');

    if (typeof rawAnswers !== 'string') {
      return fail(400, { message: 'Missing answers field.' });
    }

    const parsed = JsonSubmitSchema.safeParse(rawAnswers);
    if (!parsed.success) {
      return fail(400, { message: 'Se requieren exactamente 42 respuestas válidas.' });
    }

    const tokenResult = await readActiveToken(adminDb, params.token);
    if (!tokenResult.ok) {
      if (tokenResult.status === 410) {
        error(410, 'Este enlace ya fue utilizado o ha expirado.');
      }
      if (tokenResult.status === 404) {
        error(404, 'Token de evaluación no encontrado.');
      }
      error(500, 'Error al verificar el token.');
    }

    const { companyId, employeeId, role } = tokenResult.value.data;

    await submitAssessment(adminDb, {
      tokenValue: params.token,
      companyId,
      employeeId,
      role,
      answers: parsed.data,
    });

    redirect(303, '/test/thank-you');
  },
};
