import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Firebase Admin App ──────────────────────────────────────────────────
vi.mock('$lib/server/firebase', () => ({
  adminApp: {},
}));

// ─── Mock firebase-admin/auth ─────────────────────────────────────────────────
const mockCreateSessionCookie = vi.fn();
const mockVerifySessionCookie = vi.fn();
const mockRevokeRefreshTokens = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    createSessionCookie: mockCreateSessionCookie,
    verifySessionCookie: mockVerifySessionCookie,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  })),
}));

import {
  createSessionCookieFromIdToken,
  verifyAndReadUser,
  clearSession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from '$lib/server/session';

describe('session.ts constants', () => {
  it('SESSION_COOKIE_NAME is amelia_session', () => {
    expect(SESSION_COOKIE_NAME).toBe('amelia_session');
  });

  it('SESSION_TTL_MS is 5 days in milliseconds', () => {
    expect(SESSION_TTL_MS).toBe(5 * 24 * 60 * 60 * 1000);
  });
});

describe('createSessionCookieFromIdToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createSessionCookie with idToken and TTL, returning the cookie string', async () => {
    mockCreateSessionCookie.mockResolvedValue('cookie-string-abc');
    const result = await createSessionCookieFromIdToken('id-token-xyz');
    expect(result).toBe('cookie-string-abc');
    expect(mockCreateSessionCookie).toHaveBeenCalledWith('id-token-xyz', {
      expiresIn: SESSION_TTL_MS,
    });
  });

  it('propagates errors thrown by createSessionCookie', async () => {
    mockCreateSessionCookie.mockRejectedValue(new Error('invalid id token'));
    await expect(createSessionCookieFromIdToken('bad-token')).rejects.toThrow('invalid id token');
  });
});

describe('verifyAndReadUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a LocalsUser for a valid cookie with all claims', async () => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-1',
      email: 'admin@test.com',
      role: 'adminEmpresa',
      companyIds: ['company-a', 'company-b'],
    });
    const result = await verifyAndReadUser('valid-cookie');
    expect(result).toEqual({
      uid: 'user-1',
      email: 'admin@test.com',
      role: 'adminEmpresa',
      companyIds: ['company-a', 'company-b'],
    });
    // Verify checkRevoked=true is passed
    expect(mockVerifySessionCookie).toHaveBeenCalledWith('valid-cookie', true);
  });

  it('returns companyIds: [] when claim is absent', async () => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-2',
      email: 'admin2@test.com',
      role: 'adminEmpresa',
      // companyIds absent
    });
    const result = await verifyAndReadUser('cookie-no-ids');
    expect(result).not.toBeNull();
    expect(result?.companyIds).toEqual([]);
  });

  it('returns companyIds: [] when companyIds claim is undefined', async () => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-3',
      email: 'admin3@test.com',
      role: 'adminEmpresa',
      companyIds: undefined,
    });
    const result = await verifyAndReadUser('cookie-undefined-ids');
    expect(result).not.toBeNull();
    expect(result?.companyIds).toEqual([]);
  });

  it('returns null when role claim is missing', async () => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-4',
      email: 'norole@test.com',
      // no role
    });
    const result = await verifyAndReadUser('cookie-no-role');
    expect(result).toBeNull();
  });

  it('returns null when role is invalid', async () => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-5',
      email: 'bad@test.com',
      role: 'empleado', // not a valid UserRole
    });
    const result = await verifyAndReadUser('cookie-bad-role');
    expect(result).toBeNull();
  });

  it('returns null when verifySessionCookie throws (expired/revoked/malformed)', async () => {
    mockVerifySessionCookie.mockRejectedValue(new Error('session cookie expired'));
    const result = await verifyAndReadUser('expired-cookie');
    expect(result).toBeNull();
  });

  it('works for socio role', async () => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'partner-1',
      email: 'partner@test.com',
      role: 'socio',
    });
    const result = await verifyAndReadUser('partner-cookie');
    expect(result?.role).toBe('socio');
    expect(result?.companyIds).toEqual([]);
  });

  it('works for superadmin role', async () => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'sa-1',
      email: 'sa@test.com',
      role: 'superadmin',
    });
    const result = await verifyAndReadUser('sa-cookie');
    expect(result?.role).toBe('superadmin');
  });
});

describe('clearSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls revokeRefreshTokens with the given uid', async () => {
    mockRevokeRefreshTokens.mockResolvedValue(undefined);
    await clearSession('uid-abc');
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('uid-abc');
  });
});
