import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminDb } from '$lib/server/firebase';
import { listEmployeesForCompany } from '$lib/server/employees';
import type { Role } from '$lib/types';

export interface EmployeeReportRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  latestIsme: number | null;
  latestCompletedAt: Date | null;
}

interface LoadResult {
  rows: Promise<EmployeeReportRow[]>;
}

export const load: PageServerLoad = async ({ locals, depends }): Promise<LoadResult> => {
  depends('app:employees');

  const user = locals.user!;

  if (user.role !== 'adminEmpresa') {
    throw error(403, 'Acceso denegado');
  }

  const companyIds = user.companyIds ?? [];
  if (companyIds.length === 0) return { rows: Promise.resolve([]) };

  const rowsPromise: Promise<EmployeeReportRow[]> = (async () => {
    const rows: EmployeeReportRow[] = [];

    await Promise.all(
      companyIds.map(async (companyId) => {
        const employees = await listEmployeesForCompany(adminDb, companyId);

        for (const emp of employees) {
          rows.push({
            id: emp.id,
            name: emp.name,
            email: emp.email,
            role: emp.role,
            latestIsme: emp.latestIsme ?? null,
            latestCompletedAt: emp.latestCompletedAt ?? null,
          });
        }
      })
    );

    return rows;
  })();

  return { rows: rowsPromise };
};
