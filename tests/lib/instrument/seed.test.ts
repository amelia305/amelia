import { describe, it, expect } from 'vitest';
import { getQuestions, QUESTIONS, PILLAR_INTROS } from '$lib/instrument/seed';
import type { Role } from '$lib/types';

const ROLES: readonly Role[] = ['executive', 'middleManagement', 'operational'];

describe('getQuestions', () => {
  it.each(ROLES)('returns exactly 42 items for role "%s"', (role) => {
    const questions = getQuestions(role);
    expect(questions).toHaveLength(42);
  });

  it.each(ROLES)('every question has id, pillar (1–6), non-empty text, boolean reverse for "%s"', (role) => {
    const questions = getQuestions(role);
    for (const q of questions) {
      expect(typeof q.id).toBe('string');
      expect(q.id.length).toBeGreaterThan(0);
      expect([1, 2, 3, 4, 5, 6]).toContain(q.pillar);
      expect(typeof q.text).toBe('string');
      expect(q.text.length).toBeGreaterThan(0);
      expect(typeof q.reverse).toBe('boolean');
    }
  });

  it.each(ROLES)('has exactly 7 questions per pillar for role "%s"', (role) => {
    const questions = getQuestions(role);
    const pillarCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const q of questions) {
      pillarCounts[q.pillar]++;
    }
    for (let p = 1; p <= 6; p++) {
      expect(pillarCounts[p]).toBe(7);
    }
  });

  it.each(ROLES)('question IDs are unique within role "%s"', (role) => {
    const questions = getQuestions(role);
    const ids = questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ROLES)('returns a readonly array (same reference as QUESTIONS) for "%s"', (role) => {
    const a = getQuestions(role);
    const b = getQuestions(role);
    expect(a).toBe(b);
    expect(a).toBe(QUESTIONS[role]);
  });
});

// ─── PILLAR_INTROS ────────────────────────────────────────────────────────────

describe('PILLAR_INTROS', () => {
  const PILLARS = [1, 2, 3, 4, 5, 6] as const;

  it('has an entry for every role (executive, middleManagement, operational)', () => {
    expect(Object.keys(PILLAR_INTROS)).toEqual(
      expect.arrayContaining(['executive', 'middleManagement', 'operational'])
    );
    expect(Object.keys(PILLAR_INTROS)).toHaveLength(3);
  });

  it.each(ROLES)('has exactly 6 pillar entries for role "%s"', (role) => {
    const intros = PILLAR_INTROS[role];
    expect(Object.keys(intros)).toHaveLength(6);
    for (const pillar of PILLARS) {
      expect(intros).toHaveProperty(String(pillar));
    }
  });

  it.each(ROLES)('all strings are non-empty for role "%s"', (role) => {
    const intros = PILLAR_INTROS[role];
    for (const pillar of PILLARS) {
      const text = intros[pillar];
      expect(typeof text).toBe('string');
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it('executive strings have a different tone than operational strings (spot check pillar 1)', () => {
    // Executive tone should not equal operational — they are role-tailored copies.
    expect(PILLAR_INTROS.executive[1]).not.toBe(PILLAR_INTROS.operational[1]);
  });
});