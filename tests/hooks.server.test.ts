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
    expect(mockVerifyAndReadUser).not.toHaveBeenCalled();
  });

  it('sets locals.user to null when cookie is empty string', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const event = makeEvent('');

    await handle({ event, resolve });

    expect(event.locals.user).toBeNull();
    expect(mockVerifyAndReadUser).not.toHaveBeenCalled();
  });

  it('populates locals.user with unwrapped user when verifyAndReadUser returns ok: true', async () => {
    const user = {
      uid: 'u1',
      email: 'admin@co.com',
      role: 'adminEmpresa' as const,
      companyIds: ['cmp-1'],
    };
    mockVerifyAndReadUser.mockResolvedValue({ ok: true, user });
    const resolve = vi.fn(async () => new Response('ok'));
    const event = makeEvent('good-cookie');

    await handle({ event, resolve });

    expect(event.locals.user).toEqual(user);
    expect(mockVerifyAndReadUser).toHaveBeenCalledWith('good-cookie');
    expect(resolve).toHaveBeenCalledWith(event);
  });

  it('sets locals.user to null when verifyAndReadUser returns invalid_session', async () => {
    mockVerifyAndReadUser.mockResolvedValue({ ok: false, reason: 'invalid_session' });
    const resolve = vi.fn(async () => new Response('ok'));
    const event = makeEvent('bad-cookie');

    await handle({ event, resolve });

    expect(event.locals.user).toBeNull();
    expect(resolve).toHaveBeenCalledWith(event);
  });

  it('sets locals.user to null when verifyAndReadUser returns not_provisioned', async () => {
    mockVerifyAndReadUser.mockResolvedValue({ ok: false, reason: 'not_provisioned' });
    const resolve = vi.fn(async () => new Response('ok'));
    const event = makeEvent('unprovisioned-cookie');

    await handle({ event, resolve });

    expect(event.locals.user).toBeNull();
    expect(resolve).toHaveBeenCalledWith(event);
  });

  it('skips Firebase Auth when no cookie — public routes pay zero cost', async () => {
    const resolve = vi.fn(async () => new Response('test-page'));
    const event = makeEvent(undefined);

    await handle({ event, resolve });

    expect(mockVerifyAndReadUser).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
