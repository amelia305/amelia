import type { Handle } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, verifyAndReadUser } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
  // Cookie-absent check MUST be first — /test/[token], /login, and static
  // assets must not pay any Firebase Auth cost.
  const cookie = event.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie) {
    event.locals.user = null;
    return resolve(event);
  }

  const result = await verifyAndReadUser(cookie);
  event.locals.user = result.ok ? result.user : null;
  return resolve(event);
};
