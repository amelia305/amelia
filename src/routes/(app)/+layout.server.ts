import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/login');
  }
  return {
    user: {
      uid: locals.user.uid,
      email: locals.user.email,
      role: locals.user.role,
      companyIds: locals.user.companyIds ?? [],
    },
  };
};
