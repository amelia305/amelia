import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Phase 0 stub — ID token verification implemented in Phase 2.
  event.locals.user = null;
  return resolve(event);
};
