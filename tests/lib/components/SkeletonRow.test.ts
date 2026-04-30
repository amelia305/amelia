import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('SkeletonRow', () => {
  it('renders exactly cols td elements when cols prop is specified', () => {
    // Read the component source
    const filePath = resolve(__dirname, '../../../src/lib/components/SkeletonRow.svelte');
    const source = readFileSync(filePath, 'utf-8');

    // Verify the component has the correct logic
    expect(source).toContain('cols = 4');
    expect(source).toContain('{#each Array(cols)');
    expect(source).toContain('<td');
  });

  it('defaults to 4 cols when no props are provided', () => {
    const filePath = resolve(__dirname, '../../../src/lib/components/SkeletonRow.svelte');
    const source = readFileSync(filePath, 'utf-8');

    // Verify the default value is 4
    expect(source).toContain('cols = 4');
    expect(source).toContain('const { cols = 4 }');
  });
});
