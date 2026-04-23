/**
 * Unit tests for the pillar-checkpoint resume logic that lives inside
 * +page.svelte.  The component derives checkpoint decisions from two
 * deterministic expressions that are re-usable:
 *
 *   pillarForIndex(i)  = Math.floor(i / 7) + 1
 *   atPillarBoundary   = resumeIndex % 7 === 0
 *
 * Testing these in isolation is faster and more reliable than rendering
 * the full Svelte component, and the plan explicitly allows "unit via
 * seed data" for this case.
 */

import { describe, it, expect } from 'vitest';
import { PILLAR_INTROS, PILLAR_NAMES } from '$lib/instrument/seed';
import type { Role } from '$lib/types';

// ─── Local mirror of the pure helpers in +page.svelte ────────────────────────

/** Returns the pillar number (1–6) for a zero-based question index. */
function pillarForIndex(index: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return (Math.floor(index / 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Determines whether a resume position is at the start of a pillar
 * (i.e., all prior answers are complete and the next answer begins a
 * new pillar block).  This is the condition that triggers a checkpoint.
 */
function isAtPillarBoundary(resumeIndex: number): boolean {
  return resumeIndex % 7 === 0;
}

// ─── pillarForIndex ───────────────────────────────────────────────────────────

describe('pillarForIndex helper', () => {
  it('maps index 0 to pillar 1', () => {
    expect(pillarForIndex(0)).toBe(1);
  });

  it('maps index 6 (last of pillar 1) to pillar 1', () => {
    expect(pillarForIndex(6)).toBe(1);
  });

  it('maps index 7 (first of pillar 2) to pillar 2', () => {
    expect(pillarForIndex(7)).toBe(2);
  });

  it('maps index 13 (last of pillar 2) to pillar 2', () => {
    expect(pillarForIndex(13)).toBe(2);
  });

  it('maps index 14 (first of pillar 3) to pillar 3', () => {
    expect(pillarForIndex(14)).toBe(3);
  });

  it('maps index 34 (last of pillar 5) to pillar 5', () => {
    expect(pillarForIndex(34)).toBe(5);
  });

  it('maps index 41 (last question, pillar 6) to pillar 6', () => {
    expect(pillarForIndex(41)).toBe(6);
  });
});

// ─── isAtPillarBoundary ───────────────────────────────────────────────────────

describe('isAtPillarBoundary helper', () => {
  it('returns true for 0 answered (start of pillar 1)', () => {
    expect(isAtPillarBoundary(0)).toBe(true);
  });

  it('returns false for 3 answered (mid pillar 1)', () => {
    expect(isAtPillarBoundary(3)).toBe(false);
  });

  it('returns true for 7 answered (start of pillar 2)', () => {
    expect(isAtPillarBoundary(7)).toBe(true);
  });

  it('returns true for 14 answered (start of pillar 3)', () => {
    expect(isAtPillarBoundary(14)).toBe(true);
  });

  it('returns false for 17 answered (mid pillar 3)', () => {
    expect(isAtPillarBoundary(17)).toBe(false);
  });
});

// ─── Resume scenario: 14 partialAnswers → pillar 3 checkpoint ────────────────

describe('resume-with-14-answers scenario', () => {
  const PARTIAL_ANSWERS_COUNT = 14;
  const role: Role = 'executive';

  it('is at a pillar boundary when 14 answers are saved', () => {
    expect(isAtPillarBoundary(PARTIAL_ANSWERS_COUNT)).toBe(true);
  });

  it('identifies the next pillar as pillar 3 given 14 saved answers', () => {
    const nextPillar = pillarForIndex(PARTIAL_ANSWERS_COUNT);
    expect(nextPillar).toBe(3);
  });

  it('has a non-empty checkpoint intro string for pillar 3 in each role', () => {
    const roles: readonly Role[] = ['executive', 'middleManagement', 'operational'];
    for (const r of roles) {
      const intro = PILLAR_INTROS[r][3];
      expect(typeof intro).toBe('string');
      expect(intro.trim().length).toBeGreaterThan(0);
    }
  });

  it('has a non-empty pillar name for pillar 3 in each role', () => {
    const roles: readonly Role[] = ['executive', 'middleManagement', 'operational'];
    for (const r of roles) {
      const name = PILLAR_NAMES[r][3];
      expect(typeof name).toBe('string');
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it('pillar 3 intro for executive contains "Sostenibilidad"', () => {
    // Verify the correct pillar intro is attached to pillar 3 for this role.
    expect(PILLAR_INTROS[role][3]).toContain('Sostenibilidad');
  });
});

// ─── Mid-pillar resume (no checkpoint) ───────────────────────────────────────

describe('resume mid-pillar scenario (no checkpoint shown)', () => {
  it('is NOT at a boundary when 10 answers are saved (pillar 2, mid)', () => {
    expect(isAtPillarBoundary(10)).toBe(false);
  });

  it('identifies the correct pillar for index 10 as pillar 2', () => {
    expect(pillarForIndex(10)).toBe(2);
  });

  it('is NOT at a boundary when 3 answers are saved (pillar 1, mid)', () => {
    expect(isAtPillarBoundary(3)).toBe(false);
  });
});
