import type { Question, Answer, CompanyStats, Role, RoleStats } from '$lib/types';

type ScoresByPillar = {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
  p6: number;
};

const ROLE_WEIGHTS: Record<Role, number> = {
  executive: 0.30,
  middleManagement: 0.40,
  operational: 0.30,
};

export function scoreAnswers(
  questions: readonly Question[],
  answers: readonly Answer[]
): { scoresByPillar: ScoresByPillar; total: number } {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.value]));

  const pillarSums: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  };

  const pillarCounts: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  };

  for (const q of questions) {
    const raw = answerMap.get(q.id) ?? 0;
    const scored = q.reverse ? 6 - raw : raw;
    pillarSums[q.pillar] += scored;
    pillarCounts[q.pillar] += 1;
  }

  // Normalize each pillar to [0, 100]: Math.round(sum / (count * 5) * 100)
  const normalize = (pillar: 1 | 2 | 3 | 4 | 5 | 6): number => {
    const maxPossible = pillarCounts[pillar] * 5;
    return maxPossible > 0
      ? Math.round((pillarSums[pillar] / maxPossible) * 100)
      : 0;
  };

  const scoresByPillar: ScoresByPillar = {
    p1: normalize(1),
    p2: normalize(2),
    p3: normalize(3),
    p4: normalize(4),
    p5: normalize(5),
    p6: normalize(6),
  };

  // total remains the raw sum across all questions (used by calculateIsme formula)
  const total = pillarSums[1] + pillarSums[2] + pillarSums[3] +
    pillarSums[4] + pillarSums[5] + pillarSums[6];

  return { scoresByPillar, total };
}

export function calculateIsme(total: number): number {
  return Math.min(100, Math.max(0, Math.round((total - 42) / 168 * 100)));
}

/** Accepts only the fields `computeCompanyStats` actually reads, so both
 *  `CompanyStats` (interface) and `z.infer<typeof CompanyStatsSchema>` (which
 *  has `updatedAt: unknown`) are assignable without a cast. */
type PrevStats = { byRole: Record<Role, RoleStats> } | undefined;

export function computeCompanyStats(
  prev: PrevStats,
  newAssessment: { role: Role; isme: number }
): Omit<CompanyStats, 'updatedAt'> {
  const roles: readonly Role[] = ['executive', 'middleManagement', 'operational'];

  const prevByRole: Record<Role, RoleStats> = prev?.byRole ?? {
    executive: { avgIsme: 0, count: 0 },
    middleManagement: { avgIsme: 0, count: 0 },
    operational: { avgIsme: 0, count: 0 },
  };

  const updatedRole = newAssessment.role;
  const prevBucket = prevByRole[updatedRole];
  const newCount = prevBucket.count + 1;
  const newAvg = (prevBucket.avgIsme * prevBucket.count + newAssessment.isme) / newCount;

  const byRole: Record<Role, RoleStats> = {
    executive: prevByRole.executive,
    middleManagement: prevByRole.middleManagement,
    operational: prevByRole.operational,
    [updatedRole]: { avgIsme: newAvg, count: newCount },
  };

  const weightedNumerator = roles.reduce((sum, role) => {
    const bucket = byRole[role];
    return bucket.count > 0 ? sum + ROLE_WEIGHTS[role] * bucket.avgIsme : sum;
  }, 0);

  const weightedDenominator = roles.reduce((sum, role) => {
    return byRole[role].count > 0 ? sum + ROLE_WEIGHTS[role] : sum;
  }, 0);

  const weightedIsme = weightedDenominator > 0
    ? Math.round(weightedNumerator / weightedDenominator)
    : 0;

  return { weightedIsme, byRole };
}
