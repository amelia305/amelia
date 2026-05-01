import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock session helpers ─────────────────────────────────────────────────────
const {
  mockCreateSessionCookieFromIdToken,
  mockVerifyAndReadUser,
  mockClearSession,
} = vi.hoisted(() => ({
  mockCreateSessionCookieFromIdToken: vi.fn(),
  mockVerifyAndReadUser: vi.fn(),
  mockClearSession: vi.fn(),
}));

vi.mock('$lib/server/session', () => ({
  SESSION_COOKIE_NAME: 'amelia_session',
  SESSION_TTL_MS: 5 * 24 * 60 * 60 * 1000,
  createSessionCookieFromIdToken: mockCreateSessionCookieFromIdToken,
  verifyAndReadUser: mockVerifyAndReadUser,
  clearSession: mockClearSession,
}));

import { POST, DELETE } from '../../../src/routes/api/session/+server';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCookies() {
  const store = new Map<string, string>();
  return {
    set: vi.fn((name: string, value: string) => store.set(name, value)),
    get: vi.fn((name: string) => store.get(name)),
    delete: vi.fn((name: string) => store.delete(name)),
  };
}

function makeRequest(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function makeBadJsonRequest() {
  return {
    json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
  } as unknown as Request;
}

describe('POST /api/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when body has no idToken', async () => {
    const request = makeRequest({ notAnIdToken: 'foo' });
    const cookies = makeCookies();

    let thrownStatus: number | undefined;
    try {
      await POST({ request, cookies } as unknown as Parameters<typeof POST>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(400);
    expect(mockCreateSessionCookieFromIdToken).not.toHaveBeenCalled();
  });

  it('returns 400 when body is invalid JSON', async () => {
    const request = makeBadJsonRequest();
    const cookies = makeCookies();

    let thrownStatus: number | undefined;
    try {
      await POST({ request, cookies } as unknown as Parameters<typeof POST>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    const request = makeRequest(null);
    const cookies = makeCookies();

    let thrownStatus: number | undefined;
    try {
      await POST({ request, cookies } as unknown as Parameters<typeof POST>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(400);
  });

  it('returns 401 when createSessionCookieFromIdToken throws', async () => {
    mockCreateSessionCookieFromIdToken.mockRejectedValue(new Error('invalid token'));
    const request = makeRequest({ idToken: 'bad-id-token' });
    const cookies = makeCookies();

    let thrownStatus: number | undefined;
    try {
      await POST({ request, cookies } as unknown as Parameters<typeof POST>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(401);
  });

  it('sets HttpOnly session cookie and returns 200 for a valid idToken', async () => {
    mockCreateSessionCookieFromIdToken.mockResolvedValue('session-cookie-value');
    mockVerifyAndReadUser.mockResolvedValue({
      ok: true,
      user: { uid: 'u1', email: 'a@b.com', role: 'adminEmpresa', companyIds: [] },
    });
    const request = makeRequest({ idToken: 'valid-id-token' });
    const cookies = makeCookies();

    const response = await POST({ request, cookies } as unknown as Parameters<typeof POST>[0]);
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(cookies.set).toHaveBeenCalledWith(
      'amelia_session',
      'session-cookie-value',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      })
    );
  });

  it('returns 403 and deletes cookie when verifyAndReadUser returns not_provisioned', async () => {
    mockCreateSessionCookieFromIdToken.mockResolvedValue('session-cookie-value');
    mockVerifyAndReadUser.mockResolvedValue({ ok: false, reason: 'not_provisioned' });
    const request = makeRequest({ idToken: 'unprovisioned-id-token' });
    const cookies = makeCookies();

    const response = await POST({ request, cookies } as unknown as Parameters<typeof POST>[0]);
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, reason: 'not_provisioned' });
    expect(cookies.delete).toHaveBeenCalledWith('amelia_session', { path: '/' });
  });
});

describe('DELETE /api/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 204 and deletes the cookie when no cookie is present', async () => {
    const cookies = makeCookies();
    (cookies.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const response = await DELETE({ cookies } as unknown as Parameters<typeof DELETE>[0]);

    expect(response.status).toBe(204);
    expect(cookies.delete).toHaveBeenCalledWith('amelia_session', { path: '/' });
  });

  it('revokes refresh tokens when cookie is present and verifyAndReadUser returns ok', async () => {
    const cookies = makeCookies();
    (cookies.get as ReturnType<typeof vi.fn>).mockReturnValue('existing-cookie');
    mockVerifyAndReadUser.mockResolvedValue({
      ok: true,
      user: { uid: 'user-123', email: 'x@x.com', role: 'adminEmpresa', companyIds: [] },
    });
    mockClearSession.mockResolvedValue(undefined);

    const response = await DELETE({ cookies } as unknown as Parameters<typeof DELETE>[0]);

    expect(response.status).toBe(204);
    expect(mockClearSession).toHaveBeenCalledWith('user-123');
    expect(cookies.delete).toHaveBeenCalledWith('amelia_session', { path: '/' });
  });

  it('still clears cookie when verifyAndReadUser returns invalid_session', async () => {
    const cookies = makeCookies();
    (cookies.get as ReturnType<typeof vi.fn>).mockReturnValue('bad-cookie');
    mockVerifyAndReadUser.mockResolvedValue({ ok: false, reason: 'invalid_session' });

    const response = await DELETE({ cookies } as unknown as Parameters<typeof DELETE>[0]);

    expect(response.status).toBe(204);
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(cookies.delete).toHaveBeenCalledWith('amelia_session', { path: '/' });
  });
});
