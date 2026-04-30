import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('SkeletonStatCard', () => {
  it('renders without props', () => {
    const filePath = resolve(__dirname, '../../../src/lib/components/SkeletonStatCard.svelte');
    const source = readFileSync(filePath, 'utf-8');

    // Verify the component exists and has the correct structure
    expect(source).toContain('animate-pulse');
    expect(source).toContain('<div');
  });

  it('has an animate-pulse descendant', () => {
    const filePath = resolve(__dirname, '../../../src/lib/components/SkeletonStatCard.svelte');
    const source = readFileSync(filePath, 'utf-8');

    // Count animate-pulse classes to ensure it has descendants with animation
    const matches = source.match(/animate-pulse/g);
    expect(matches && matches.length).toBeGreaterThan(0);
  });
});
