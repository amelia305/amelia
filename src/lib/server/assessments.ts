import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { error } from '@sveltejs/kit';
import type { Role, Answer } from '$lib/types';
import { CompanyStatsSchema } from '$lib/types';
import { getQuestions, INSTRUMENT_VERSION } from '$lib/instrument/seed';
import { scoreAnswers, calculateIsme, computeCompanyStats } from '$lib/server/scoring';
import { markTokenCompleted } from '$lib/server/tokens';

type SubmitArgs = {
  tokenValue: string;
  companyId: string;
  employeeId: string;
  role: Role;
  answers: readonly Answer[];
};

export async function submitAssessment(
  db: Firestore,
  args: SubmitArgs
): Promise<{ assessmentId: string }> {
  const tokenRef = db.collection('tokens').doc(args.tokenValue);
  const companyRef = db.collection('companies').doc(args.companyId);
  const employeeRef = companyRef.collection('employees').doc(args.employeeId);
  const assessmentRef = companyRef.collection('assessments').doc();
  const auditRef = companyRef.collection('audit').doc();

  const questions = getQuestions(args.role);
  const { scoresByPillar, total } = scoreAnswers(questions, args.answers);
  const isme = calculateIsme(total);

  const assessmentId = assessmentRef.id;

  await db.runTransaction(async (t) => {
    const tokenSnap = await t.get(tokenRef);
    const companySnap = await t.get(companyRef);

    const tokenStatus = tokenSnap.data()?.['status'];
    if (tokenStatus !== 'pending' && tokenStatus !== 'inProgress') {
      throw error(409, 'ALREADY_COMPLETED');
    }

    const tokenExpiresAt = tokenSnap.data()?.['expiresAt'];
    if (tokenExpiresAt instanceof Timestamp && tokenExpiresAt.toMillis() < Date.now()) {
      throw error(410, 'Token has expired');
    }

    const rawStats = companySnap.data()?.['stats'];
    const parsedStats = CompanyStatsSchema.safeParse(rawStats);
    const prevStats = parsedStats.success ? parsedStats.data : undefined;

    const newStats = computeCompanyStats(prevStats, { role: args.role, isme });
    const now = Timestamp.now();

    t.set(assessmentRef, {
      employeeId: args.employeeId,
      role: args.role,
      answers: [...args.answers],
      scoresByPillar,
      isme,
      completedAt: now,
      instrumentVersion: INSTRUMENT_VERSION,
    });

    markTokenCompleted(t, tokenRef, now);

    t.update(employeeRef, { latestAssessmentId: assessmentId });

    t.update(companyRef, {
      stats: {
        ...newStats,
        updatedAt: now,
      },
    });

    t.set(auditRef, {
      action: 'assessment.submitted',
      actorUid: args.employeeId,
      timestamp: now,
      meta: {
        tokenValue: args.tokenValue,
        assessmentId,
        role: args.role,
        isme,
      },
    });
  });

  return { assessmentId };
}
