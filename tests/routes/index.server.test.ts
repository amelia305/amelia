import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock firebase ────────────────────────────────────────────────────────────
vi.mock('$lib/server/firebase', () => ({
	adminDb: {},
}));

// ─── Mock tokens module ───────────────────────────────────────────────────────
const { mockListRecentValidTokens } = vi.hoisted(() => ({
	mockListRecentValidTokens: vi.fn(),
}));

vi.mock('$lib/server/tokens', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/tokens')>();
	return {
		...actual,
		listRecentValidTokens: mockListRecentValidTokens,
	};
});

import { load } from '../../src/routes/+page.server';
import type { RecentToken } from '$lib/server/tokens';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('index page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns tokens from listRecentValidTokens', async () => {
		const mockTokens: RecentToken[] = [
			{
				value: 'tok-1',
				status: 'pending',
				role: 'executive',
				createdAt: new Date('2026-04-20'),
				expiresAt: new Date('2026-05-20'),
			},
			{
				value: 'tok-2',
				status: 'inProgress',
				role: 'middleManagement',
				createdAt: new Date('2026-04-19'),
				expiresAt: new Date('2026-05-19'),
			},
		];

		mockListRecentValidTokens.mockResolvedValue(mockTokens);

		const result = await load({} as Parameters<typeof load>[0]);

		expect(result).toEqual({ tokens: mockTokens });
		expect(mockListRecentValidTokens).toHaveBeenCalledTimes(1);
	});

	it('returns empty tokens array when no valid tokens exist', async () => {
		mockListRecentValidTokens.mockResolvedValue([]);

		const result = await load({} as Parameters<typeof load>[0]);

		expect(result).toEqual({ tokens: [] });
		expect(mockListRecentValidTokens).toHaveBeenCalledTimes(1);
	});
});
