import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminDb } from '$lib/server/firebase';
import {
  listCompaniesForAdmin,
  buildCompanyDashboard,
  type CompanyDashboard,
} from '$lib/server/companies';

interface LoadResult {
  dashboards: Promise<CompanyDashboard[]>;
}

export const load: PageServerLoad = async ({ locals, depends }): Promise<LoadResult> => {
  depends('app:dashboard');

  const user = locals.user!; // guaranteed by (app)/+layout.server.ts

  if (user.role === 'adminEmpresa') {
    const companyIds = user.companyIds ?? [];
    const dashboardsPromise = listCompaniesForAdmin(adminDb, companyIds).then((companies) =>
      Promise.all(companies.map((c) => buildCompanyDashboard(adminDb, c)))
    );
    return { dashboards: dashboardsPromise };
  }

  if (user.role === 'socio' || user.role === 'superadmin') {
    throw error(501, 'not implemented');
  }

  throw error(403, 'Acceso denegado');
};
