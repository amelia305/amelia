import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionCookieFromIdToken,
  clearSession,
} from '$lib/server/session';
import { verifyAndReadUser } from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>)['idToken'] !== 'string'
  ) {
    throw error(400, 'Missing idToken');
  }

  const idToken = (body as Record<string, string>)['idToken'];

  let sessionCookie: string;
  try {
    sessionCookie = await createSessionCookieFromIdToken(idToken);
  } catch {
    throw error(401, 'Invalid ID token');
  }

  cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  const cookie = cookies.get(SESSION_COOKIE_NAME);

  if (cookie) {
    // Best-effort: read user from cookie to revoke refresh tokens.
    const user = await verifyAndReadUser(cookie);
    if (user) {
      await clearSession(user.uid);
    }
  }

  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  return new Response(null, { status: 204 });
};
