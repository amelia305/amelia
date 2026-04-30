import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminDb } from '$lib/server/firebase';
import { getEmployee } from '$lib/server/employees';
import { AssessmentSchema, type Role } from '$lib/types';
import { getQuestions } from '$lib/instrument/seed';

export interface AnswerDetail {
  questionId: string;
  text: string;
  pillar: number;
  value: number;
  reverse: boolean;
}

export interface AssessmentDetail {
  id: string;
  role: Role;
  isme: number;
  scoresByPillar: Record<string, number>;
  completedAt: unknown;
  answers: AnswerDetail[];
}

interface LoadResult {
  employee: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  assessments: AssessmentDetail[];
}

export const load: PageServerLoad = async ({ locals, params, depends }): Promise<LoadResult> => {
  // Future-proofing stub: paired invalidate('app:reportes-detail') call will live in
  // the action or store that triggers a refresh of this route (e.g. after reassignment).
  // No caller exists yet — this is a forward-compatibility hook per perf-ux-app-routes review.
  depends('app:reportes-detail');

  const user = locals.user!;

  if (user.role !== 'adminEmpresa') {
    throw error(403, 'Acceso denegado');
  }

  // companyId is derived exclusively from the verified session — never from URL params.
  // This is a stricter security posture than the old [companyId]/[employeeId] route.
  const companyIds = user.companyIds ?? [];
  if (companyIds.length === 0) throw error(403, 'Acceso denegado');
  const companyId = companyIds[0];
  const { employeeId } = params;

  const [employee, snap] = await Promise.all([
    getEmployee(adminDb, employeeId, companyId),
    adminDb
      .collection('companies')
      .doc(companyId)
      .collection('assessments')
      .where('employeeId', '==', employeeId)
      .orderBy('completedAt', 'desc')
      .get(),
  ]);

  if (!employee) {
    throw error(404, 'Empleado no encontrado');
  }

  const questions = getQuestions(employee.role);
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const assessments: AssessmentDetail[] = [];
  for (const doc of snap.docs) {
    const parsed = AssessmentSchema.safeParse(doc.data());
    if (!parsed.success) continue;

    const answerDetails: AnswerDetail[] = parsed.data.answers
      .map((a): AnswerDetail | null => {
        const q = questionMap.get(a.questionId);
        if (!q) return null;
        return {
          questionId: a.questionId,
          text: q.text,
          pillar: q.pillar,
          value: a.value,
          reverse: q.reverse,
        };
      })
      .filter((a): a is AnswerDetail => a !== null);

    assessments.push({
      id: doc.id,
      role: parsed.data.role,
      isme: parsed.data.isme,
      scoresByPillar: parsed.data.scoresByPillar,
      completedAt: parsed.data.completedAt,
      answers: answerDetails,
    });
  }

  return {
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
    },
    assessments,
  };
};
