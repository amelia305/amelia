import type { PageServerLoad } from './$types';
import { adminDb } from '$lib/server/firebase';
import { listRecentValidTokens, type RecentToken } from '$lib/server/tokens';

interface LoadResult {
	tokens: RecentToken[];
}

export const load: PageServerLoad = async (): Promise<LoadResult> => {
	const tokens = await listRecentValidTokens(adminDb);
	return { tokens };
};
