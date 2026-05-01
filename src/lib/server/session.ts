import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '$lib/server/firebase';
import type { LocalsUser } from '$lib/types';
import { UserRoleSchema } from '$lib/types';

export const SESSION_COOKIE_NAME = 'amelia_session';
export const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export type VerifyResult =
  | { ok: true; user: LocalsUser }
  | { ok: false; reason: 'invalid_session' | 'not_provisioned' };

async function attempt<T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await p };
  } catch {
    return { ok: false };
  }
}

export async function createSessionCookieFromIdToken(idToken: string): Promise<string> {
  const auth = getAuth(adminApp);
  return auth.createSessionCookie(idToken, { expiresIn: SESSION_TTL_MS });
}

export async function verifyAndReadUser(cookie: string): Promise<VerifyResult> {
  const decoded = await attempt(getAuth(adminApp).verifySessionCookie(cookie, true /* checkRevoked */));
  if (!decoded.ok) return { ok: false, reason: 'invalid_session' };

  const roleResult = UserRoleSchema.safeParse(decoded.value['role']);
  if (!roleResult.success) return { ok: false, reason: 'not_provisioned' };

  const rawIds: unknown = decoded.value['companyIds'];
  const companyIds = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === 'string')
    : [];

  return {
    ok: true,
    user: {
      uid: decoded.value.uid,
      email: decoded.value.email ?? null,
      role: roleResult.data,
      companyIds,
    },
  };
}

export async function clearSession(uid: string): Promise<void> {
  await getAuth(adminApp).revokeRefreshTokens(uid);
}
