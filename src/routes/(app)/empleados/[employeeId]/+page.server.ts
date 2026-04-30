import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';
import { adminDb } from '$lib/server/firebase';
import { getEmployee } from '$lib/server/employees';
import {
  createTokenForEmployee,
  listTokensForEmployee,
  revokeToken,
} from '$lib/server/tokens';
import { PUBLIC_BASE_URL } from '$env/static/public';

interface LoadResult {
  employee: {
    id: string;
    name: string;
    email: string;
    role: import('$lib/types').Role;
    archived: boolean;
  };
  tokens: Array<{
    value: string;
    status: string;
    createdAt: unknown;
    expiresAt: unknown;
  }>;
  companyId: string;
}

export const load: PageServerLoad = async ({ locals, params, depends }): Promise<LoadResult> => {
  depends('app:tokens');

  const user = locals.user!;

  if (user.role !== 'adminEmpresa') {
    throw error(403, 'Acceso denegado');
  }

  const companyId = (user.companyIds ?? [])[0];
  if (!companyId) {
    throw error(403, 'Sin empresa asignada');
  }

  const [employee, tokens] = await Promise.all([
    getEmployee(adminDb, params.employeeId, companyId),
    listTokensForEmployee(adminDb, params.employeeId, companyId),
  ]);

  if (!employee) {
    throw error(404, 'Empleado no encontrado');
  }

  return {
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      archived: employee.archived,
    },
    tokens,
    companyId,
  };
};

// ─── Zod schemas ───────────────────────────────────────────────────────────────

const RevokeTokenSchema = z.object({
  tokenValue: z.string().min(1),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const actions: Actions = {
  createToken: async ({ params, locals }) => {
    const user = locals.user;
    if (!user || user.role !== 'adminEmpresa') {
      return fail(403, { error: 'Acceso denegado' });
    }

    const companyId = (user.companyIds ?? [])[0];
    if (!companyId) {
      return fail(400, { error: 'Sin empresa asignada' });
    }

    const result = await createTokenForEmployee(adminDb, {
      companyId,
      employeeId: params.employeeId,
      actorUid: user.uid,
    });

    if (!result.ok) {
      return fail(result.status === 404 ? 404 : 500, { error: result.message });
    }

    const testUrl = `${PUBLIC_BASE_URL}/test/${result.value.value}`;
    return { success: true, testUrl, tokenValue: result.value.value };
  },

  revokeToken: async ({ request, locals }) => {
    const user = locals.user;
    if (!user || user.role !== 'adminEmpresa') {
      return fail(403, { error: 'Acceso denegado' });
    }

    const companyId = (user.companyIds ?? [])[0];
    if (!companyId) {
      return fail(400, { error: 'Sin empresa asignada' });
    }

    const formData = await request.formData();
    const parsed = RevokeTokenSchema.safeParse({ tokenValue: formData.get('tokenValue') });
    if (!parsed.success) {
      return fail(422, { error: 'Token inválido' });
    }

    const result = await revokeToken(adminDb, parsed.data.tokenValue, companyId, user.uid);

    if (!result.ok) {
      if (result.status === 400) {
        return fail(400, { error: 'cannot_revoke_completed', message: 'No se puede revocar una evaluación completada. Es un registro inmutable.' });
      }
      return fail(result.status === 404 ? 404 : 500, { error: result.message });
    }

    return { success: true };
  },
};
