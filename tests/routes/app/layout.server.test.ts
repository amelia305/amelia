import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from '../../../src/routes/(app)/+layout.server';
import type { LocalsUser } from '$lib/types';

describe('(app)/+layout.server.ts load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when locals.user is null', async () => {
    const locals = { user: null };
    let redirectTo: string | undefined;
    let redirectStatus: number | undefined;

    try {
      await load({ locals } as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      // SvelteKit redirect throws an object with `status` and `location`
      const err = e as { status: number; location: string };
      redirectStatus = err.status;
      redirectTo = err.location;
    }

    expect(redirectStatus).toBe(303);
    expect(redirectTo).toBe('/login');
  });

  it('returns user data when locals.user is set', async () => {
    const user: LocalsUser = {
      uid: 'u1',
      email: 'admin@company.com',
      role: 'adminEmpresa',
      companyIds: ['cmp-1'],
    };
    const locals = { user };

    const raw = await load({ locals } as Parameters<typeof load>[0]);
    const result = raw as { user: LocalsUser };

    expect(result.user.uid).toBe('u1');
    expect(result.user.email).toBe('admin@company.com');
    expect(result.user.role).toBe('adminEmpresa');
    expect(result.user.companyIds).toEqual(['cmp-1']);
  });

  it('returns companyIds as empty array when claim is absent', async () => {
    // companyIds is optional in LocalsUser
    const user = {
      uid: 'u2',
      email: 'sa@company.com',
      role: 'superadmin' as const,
      // no companyIds
    } satisfies LocalsUser;
    const locals = { user };

    const raw = await load({ locals } as Parameters<typeof load>[0]);
    const result = raw as { user: LocalsUser };

    expect(result.user.companyIds).toEqual([]);
  });
});
