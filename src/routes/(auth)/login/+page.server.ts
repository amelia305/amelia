import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// If the user already has a valid session, send them to the dashboard.
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    redirect(303, '/dashboard');
  }
  return {};
};
