import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';
import { adminDb } from '$lib/server/firebase';
import {
  listEmployeesForCompany,
  createEmployee,
  archiveEmployee,
} from '$lib/server/employees';
import { RoleSchema } from '$lib/types';

interface LoadResult {
  employees: Promise<Awaited<ReturnType<typeof listEmployeesForCompany>>>;
  companyId: string;
}

export const load: PageServerLoad = async ({ locals, url, depends }): Promise<LoadResult> => {
  depends('app:employees');

  const user = locals.user!;

  if (user.role !== 'adminEmpresa') {
    throw error(403, 'Acceso denegado');
  }

  const companyId = (user.companyIds ?? [])[0];
  if (!companyId) {
    return { employees: Promise.resolve([]), companyId: '' };
  }

  const showArchived = url.searchParams.get('showArchived') === '1';

  return {
    employees: listEmployeesForCompany(adminDb, companyId, { showArchived }),
    companyId,
  };
};

// ─── Zod schemas for form actions ─────────────────────────────────────────────

const CreateEmployeeSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  email: z.string().email('Correo inválido'),
  role: RoleSchema,
  nationalId: z.string().min(1, 'Cédula requerida'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  gender: z.enum(['male', 'female'], { required_error: 'Género requerido' }),
  tenureMonths: z.coerce.number().int().nonnegative('Debe ser 0 o más'),
});

const ArchiveEmployeeSchema = z.object({
  employeeId: z.string().min(1),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const actions: Actions = {
  createEmployee: async ({ request, locals }) => {
    const user = locals.user;
    if (!user || user.role !== 'adminEmpresa') {
      return fail(403, { error: 'Acceso denegado' });
    }

    const companyId = (user.companyIds ?? [])[0];
    if (!companyId) {
      return fail(400, { error: 'Sin empresa asignada' });
    }

    const formData = await request.formData();
    const raw = {
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      nationalId: formData.get('nationalId'),
      birthDate: formData.get('birthDate'),
      gender: formData.get('gender'),
      tenureMonths: formData.get('tenureMonths'),
    };

    const parsed = CreateEmployeeSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return fail(422, { fieldErrors });
    }

    try {
      const { id } = await createEmployee(adminDb, parsed.data, companyId, user.uid);
      return { success: true, employeeId: id };
    } catch (err) {
      return fail(500, { error: 'Error al crear empleado' });
    }
  },

  archiveEmployee: async ({ request, locals }) => {
    const user = locals.user;
    if (!user || user.role !== 'adminEmpresa') {
      return fail(403, { error: 'Acceso denegado' });
    }

    const companyId = (user.companyIds ?? [])[0];
    if (!companyId) {
      return fail(400, { error: 'Sin empresa asignada' });
    }

    const formData = await request.formData();
    const parsed = ArchiveEmployeeSchema.safeParse({ employeeId: formData.get('employeeId') });
    if (!parsed.success) {
      return fail(422, { error: 'ID de empleado inválido' });
    }

    try {
      await archiveEmployee(adminDb, parsed.data.employeeId, companyId, user.uid);
      return { success: true };
    } catch (err) {
      return fail(500, { error: err instanceof Error ? err.message : 'Error al archivar empleado' });
    }
  },
};
