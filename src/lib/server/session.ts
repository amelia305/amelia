import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '$lib/server/firebase';
import type { LocalsUser } from '$lib/types';

export const SESSION_COOKIE_NAME = 'amelia_session';
export const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

/**
 * Exchange a Firebase ID token for a session cookie value (base64 string).
 * Throws if the ID token is invalid or the exchange fails.
 */
export async function createSessionCookieFromIdToken(idToken: string): Promise<string> {
  const auth = getAuth(adminApp);
  return auth.createSessionCookie(idToken, { expiresIn: SESSION_TTL_MS });
}

/**
 * Verify a session cookie and extract the user's claims.
 * Returns null on any verification failure (expired, revoked, malformed).
 * `companyIds` absent or undefined in custom claims → returns `companyIds: []`.
 */
export async function verifyAndReadUser(cookie: string): Promise<LocalsUser | null> {
  try {
    const auth = getAuth(adminApp);
    const decoded = await auth.verifySessionCookie(cookie, true /* checkRevoked */);

    const role = decoded['role'] as string | undefined;
    if (!role) return null;

    const validRoles = ['superadmin', 'socio', 'adminEmpresa'] as const;
    if (!validRoles.includes(role as (typeof validRoles)[number])) return null;

    const companyIds: string[] = Array.isArray(decoded['companyIds'])
      ? (decoded['companyIds'] as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      role: role as LocalsUser['role'],
      companyIds,
    };
  } catch {
    return null;
  }
}

/**
 * Revoke the user's refresh tokens so the session cookie cannot be refreshed.
 */
export async function clearSession(uid: string): Promise<void> {
  const auth = getAuth(adminApp);
  await auth.revokeRefreshTokens(uid);
}
