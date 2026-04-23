import { describe, it, expect } from 'vitest';
import { scoreAnswers, calculateIsme, computeCompanyStats } from '$lib/server/scoring';
import type { Question, Answer } from '$lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQuestion(
  id: string,
  pillar: 1 | 2 | 3 | 4 | 5 | 6,
  reverse: boolean
): Question {
  return { id, pillar, text: 'stub', reverse };
}

function makeAnswer(questionId: string, value: 1 | 2 | 3 | 4 | 5): Answer {
  return { questionId, value };
}

// ─── scoreAnswers ─────────────────────────────────────────────────────────────

describe('scoreAnswers', () => {
  it('no R-questions: pillar score normalized to 0-100', () => {
    // 2 questions in p1, raw sum = 4+3 = 7, maxPossible = 2*5 = 10
    // normalized = round(7/10 * 100) = 70
    const questions: Question[] = [
      makeQuestion('q1', 1, false),
      makeQuestion('q2', 1, false),
    ];
    const answers: Answer[] = [
      makeAnswer('q1', 4),
      makeAnswer('q2', 3),
    ];
    const { scoresByPillar, total } = scoreAnswers(questions, answers);
    expect(scoresByPillar.p1).toBe(70); // round(7/10 * 100)
    expect(total).toBe(7); // raw sum unchanged — used by calculateIsme
  });

  it('R-questions are inverted with 6 - value before normalizing', () => {
    // q1: 6-2=4 (reversed), q2: 3 — raw sum = 7, maxPossible = 2*5 = 10
    // normalized p2 = round(7/10 * 100) = 70
    const questions: Question[] = [
      makeQuestion('q1', 2, true), // 6 - 2 = 4
      makeQuestion('q2', 2, false), // 3
    ];
    const answers: Answer[] = [
      makeAnswer('q1', 2),
      makeAnswer('q2', 3),
    ];
    const { scoresByPillar, total } = scoreAnswers(questions, answers);
    expect(scoresByPillar.p2).toBe(70); // round(7/10 * 100)
    expect(total).toBe(7); // raw sum unchanged
  });

  it('normalizes per-pillar independently across multiple pillars', () => {
    // p1: 1 question, score 5 → round(5/5*100) = 100
    // p2: 1 question, score 1 → round(1/5*100) = 20
    // p3: 1 question, reverse of 1 → score 5 → round(5/5*100) = 100
    const questions: Question[] = [
      makeQuestion('a', 1, false),
      makeQuestion('b', 2, false),
      makeQuestion('c', 3, true),
    ];
    const answers: Answer[] = [
      makeAnswer('a', 5),
      makeAnswer('b', 1),
      makeAnswer('c', 1), // reverse → 6 - 1 = 5
    ];
    const { scoresByPillar, total } = scoreAnswers(questions, answers);
    expect(scoresByPillar.p1).toBe(100); // round(5/5 * 100)
    expect(scoresByPillar.p2).toBe(20);  // round(1/5 * 100)
    expect(scoresByPillar.p3).toBe(100); // round(5/5 * 100)
    expect(total).toBe(11); // raw sum unchanged
  });

  it('missing answer for a question scores 0', () => {
    const questions: Question[] = [makeQuestion('q1', 1, false)];
    const answers: Answer[] = [];
    const { scoresByPillar, total } = scoreAnswers(questions, answers);
    expect(scoresByPillar.p1).toBe(0);
    expect(total).toBe(0);
  });
});

// ─── calculateIsme ────────────────────────────────────────────────────────────

describe('calculateIsme', () => {
  it('all-5 responses (42 questions) → ISME = 100', () => {
    // max total = 42 * 5 = 210 → (210 - 42) / 168 * 100 = 100
    expect(calculateIsme(210)).toBe(100);
  });

  it('all-1 responses (42 questions) → ISME = 0', () => {
    // min total = 42 * 1 = 42 → (42 - 42) / 168 * 100 = 0
    expect(calculateIsme(42)).toBe(0);
  });

  it('rounds to integer', () => {
    // (126 - 42) / 168 * 100 = 50
    const result = calculateIsme(126);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(50);
  });

  it('clamps to 0 when total below minimum', () => {
    expect(calculateIsme(0)).toBe(0);
  });

  it('clamps to 100 when total above maximum', () => {
    expect(calculateIsme(9999)).toBe(100);
  });
});

// ─── computeCompanyStats ──────────────────────────────────────────────────────

describe('computeCompanyStats', () => {
  it('30/40/30 ponderación: executive weight 0.30', () => {
    // Single executive entry with isme=100 → weightedIsme = 100 (only role with count>0)
    const result = computeCompanyStats(undefined, { role: 'executive', isme: 100 });
    expect(result.byRole.executive.avgIsme).toBe(100);
    expect(result.byRole.executive.count).toBe(1);
    // Only executive has count>0 so weightedNumerator=0.30*100, weightedDenominator=0.30
    expect(result.weightedIsme).toBe(100);
  });

  it('30/40/30 ponderación: middleManagement weight is higher (0.40)', () => {
    // Two separate submissions, same ISME; middle should dominate weighting
    const afterExec = computeCompanyStats(undefined, { role: 'executive', isme: 60 });
    const afterMid = computeCompanyStats(
      afterExec,
      { role: 'middleManagement', isme: 100 }
    );
    // weightedNumerator = 0.30*60 + 0.40*100 = 18 + 40 = 58
    // weightedDenominator = 0.30 + 0.40 = 0.70
    // weightedIsme = round(58 / 0.70) ≈ round(82.857) = 83
    expect(afterMid.weightedIsme).toBe(83);
  });

  it('handles undefined prev (no prior stats) without NaN', () => {
    const result = computeCompanyStats(undefined, { role: 'operational', isme: 75 });
    expect(Number.isNaN(result.weightedIsme)).toBe(false);
    expect(result.byRole.operational.count).toBe(1);
    expect(result.byRole.operational.avgIsme).toBe(75);
  });

  it('handles missing cargo roles (count=0) without contributing NaN to weighted average', () => {
    const result = computeCompanyStats(undefined, { role: 'middleManagement', isme: 80 });
    // executive and operational both have count=0 and must NOT contribute to NaN
    expect(Number.isNaN(result.weightedIsme)).toBe(false);
    expect(result.byRole.executive.count).toBe(0);
    expect(result.byRole.operational.count).toBe(0);
    // Only middleManagement contributes: round(0.40*80 / 0.40) = 80
    expect(result.weightedIsme).toBe(80);
  });

  it('averages correctly when same role submits twice', () => {
    const first = computeCompanyStats(undefined, { role: 'executive', isme: 60 });
    const second = computeCompanyStats(
      first,
      { role: 'executive', isme: 100 }
    );
    // avg = (60 + 100) / 2 = 80
    expect(second.byRole.executive.avgIsme).toBe(80);
    expect(second.byRole.executive.count).toBe(2);
  });

  it('does not mutate the prev input object', () => {
    const prev = {
      weightedIsme: 50,
      byRole: {
        executive: { avgIsme: 50, count: 1 },
        middleManagement: { avgIsme: 0, count: 0 },
        operational: { avgIsme: 0, count: 0 },
      },
      updatedAt: {} as FirebaseFirestore.Timestamp,
    };
    const prevExecBefore = { ...prev.byRole.executive };
    computeCompanyStats(prev, { role: 'executive', isme: 100 });
    expect(prev.byRole.executive).toEqual(prevExecBefore);
  });
});
