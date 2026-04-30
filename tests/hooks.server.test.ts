import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock session module ───────────────────────────────────────────────────────
const { mockVerifyAndReadUser } = vi.hoisted(() => ({
  mockVerifyAndReadUser: vi.fn(),
}));

vi.mock('$lib/server/session', () => ({
  SESSION_COOKIE_NAME: 'amelia_session',
  verifyAndReadUser: mockVerifyAndReadUser,
}));

import { handle } from '../src/hooks.server';

function makeEvent(cookie: string | undefined) {
  return {
    locals: {} as Record<string, unknown>,
    cookies: {
      get: vi.fn((name: string) => (name === 'amelia_session' ? cookie : undefined)),
    },
  } as unknown as Parameters<typeof handle>[0]['event'];
}

describe('hooks.server.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets locals.user to null and calls resolve when cookie is absent', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const event = makeEvent(undefined);

    await handle({ event, resolve });

    expect(event.locals.user).toBeNull();
    expect(resolve).toHaveBeenCalledWith(event);
    // Firebase Auth must NOT be called — cookie-absent branch is first
    expect(mockVerifyAndReadUser).not.toHaveBeenCalled();
  });

  it('sets locals.user to null when cookie is empty string', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const event = makeEvent('');

    await handle({ event, resolve });

    expect(event.locals.user).toBeNull();
    expect(mockVerifyAndReadUser).not.toHaveBeenCalled();
  });

  it('populates locals.user when cookie is valid', async () => {
    const user = {
      uid: 'u1',
      email: 'admin@co.com',
      role: 'adminEmpresa' as const,
      companyIds: ['cmp-1'],
    };
    mockVerifyAndReadUser.mockResolvedValue(user);
    const resolve = vi.fn(async () => new Response('ok'));
    const event = makeEvent('good-cookie');

    await handle({ event, resolve });

    expect(event.locals.user).toEqual(user);
    expect(mockVerifyAndReadUser).toHaveBeenCalledWith('good-cookie');
    expect(resolve).toHaveBeenCalledWith(event);
  });

  it('sets locals.user to null when verifyAndReadUser returns null (invalid cookie)', async () => {
    mockVerifyAndReadUser.mockResolvedValue(null);
    const resolve = vi.fn(async () => new Response('ok'));
    const event = makeEvent('bad-cookie');

    await handle({ event, resolve });

    expect(event.locals.user).toBeNull();
    expect(resolve).toHaveBeenCalledWith(event);
  });

  it('skips Firebase Auth when no cookie — public routes pay zero cost', async () => {
    const resolve = vi.fn(async () => new Response('test-page'));
    // Simulate request to /test/some-token — no session cookie
    const event = makeEvent(undefined);

    await handle({ event, resolve });

    expect(mockVerifyAndReadUser).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
