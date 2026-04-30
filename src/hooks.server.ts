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

  event.locals.user = await verifyAndReadUser(cookie);
  return resolve(event);
};
