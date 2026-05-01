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

  const result = await verifyAndReadUser(sessionCookie);
  if (!result.ok) {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    if (result.reason === 'not_provisioned') {
      return json({ ok: false, reason: 'not_provisioned' }, { status: 403 });
    }
    throw error(500, 'Session verification failed');
  }

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  const cookie = cookies.get(SESSION_COOKIE_NAME);

  if (cookie) {
    const result = await verifyAndReadUser(cookie);
    if (result.ok) {
      await clearSession(result.user.uid);
    }
  }

  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  return new Response(null, { status: 204 });
};
