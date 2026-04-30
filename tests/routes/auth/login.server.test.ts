import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from '../../../src/routes/(auth)/login/+page.server';
import type { LocalsUser } from '$lib/types';

describe('(auth)/login/+page.server.ts load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /dashboard when user is already logged in', async () => {
    const user: LocalsUser = {
      uid: 'u1',
      email: 'admin@co.com',
      role: 'adminEmpresa',
      companyIds: ['cmp-1'],
    };

    let redirectTo: string | undefined;
    let redirectStatus: number | undefined;

    try {
      await load({ locals: { user } } as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      const err = e as { status: number; location: string };
      redirectStatus = err.status;
      redirectTo = err.location;
    }

    expect(redirectStatus).toBe(303);
    expect(redirectTo).toBe('/dashboard');
  });

  it('returns empty object when user is not logged in', async () => {
    const result = await load({ locals: { user: null } } as Parameters<typeof load>[0]);
    expect(result).toEqual({});
  });
});
