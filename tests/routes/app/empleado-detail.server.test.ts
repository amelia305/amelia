import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock firebase ────────────────────────────────────────────────────────────
vi.mock('$lib/server/firebase', () => ({
  adminDb: {},
}));

// ─── Mock employees module ────────────────────────────────────────────────────
const { mockGetEmployee, mockListTokensForEmployee, mockCreateTokenForEmployee, mockRevokeToken } = vi.hoisted(() => ({
  mockGetEmployee: vi.fn(),
  mockListTokensForEmployee: vi.fn(),
  mockCreateTokenForEmployee: vi.fn(),
  mockRevokeToken: vi.fn(),
}));

vi.mock('$lib/server/employees', () => ({
  getEmployee: mockGetEmployee,
}));

vi.mock('$lib/server/tokens', () => ({
  createTokenForEmployee: mockCreateTokenForEmployee,
  listTokensForEmployee: mockListTokensForEmployee,
  revokeToken: mockRevokeToken,
}));

// ─── Mock PUBLIC_BASE_URL ─────────────────────────────────────────────────────
vi.mock('$env/static/public', () => ({
  PUBLIC_BASE_URL: 'http://localhost:5173',
}));

import { load, actions } from '../../../src/routes/(app)/empleados/[employeeId]/+page.server';
import type { LocalsUser } from '$lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAdminLocals(companyIds: string[] = ['cmp-1']): { user: LocalsUser } {
  return {
    user: {
      uid: 'u1',
      email: 'admin@co.com',
      role: 'adminEmpresa',
      companyIds,
    },
  };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const mockEmployee = {
  id: 'emp-1',
  name: 'Juan',
  email: 'juan@co.com',
  role: 'executive' as const,
  nationalId: '123',
  birthDate: '1990-01-01',
  gender: 'M',
  tenureMonths: 12,
  archived: false,
};

// ─── load ─────────────────────────────────────────────────────────────────────

describe('empleados/[employeeId] load', () => {
  const mockDepends = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDepends.mockClear();
  });

  it('throws 403 for non-adminEmpresa role', async () => {
    let thrownStatus: number | undefined;
    try {
      await load({
        locals: { user: { uid: 'p1', email: 'p@b.com', role: 'socio', companyIds: [] } },
        params: { employeeId: 'emp-1' },
        depends: mockDepends,
      } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(403);
  });

  it('throws 404 when employee not found in admin company', async () => {
    mockGetEmployee.mockResolvedValue(null);
    mockListTokensForEmployee.mockResolvedValue([]);

    let thrownStatus: number | undefined;
    try {
      await load({
        locals: makeAdminLocals(),
        params: { employeeId: 'emp-missing' },
        depends: mockDepends,
      } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(404);
  });

  it('returns employee and tokens for valid request', async () => {
    mockGetEmployee.mockResolvedValue(mockEmployee);
    mockListTokensForEmployee.mockResolvedValue([
      { value: 'tok-1', status: 'pending', createdAt: null, expiresAt: null },
    ]);

    const raw = await load({
      locals: makeAdminLocals(),
      params: { employeeId: 'emp-1' },
      depends: mockDepends,
    } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as {
      employee: { id: string };
      tokens: Array<{ value: string }>;
      companyId: string;
    };

    expect(result.employee.id).toBe('emp-1');
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].value).toBe('tok-1');
    expect(result.companyId).toBe('cmp-1');
  });

  describe('parallel load', () => {
    it('runs getEmployee and listTokensForEmployee concurrently with total elapsed < 15ms', async () => {
      const delayMs = 10;
      mockGetEmployee.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockEmployee), delayMs);
          })
      );
      mockListTokensForEmployee.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([{ value: 'tok-1', status: 'pending', createdAt: null, expiresAt: null }]), delayMs);
          })
      );

      const startTime = performance.now();
      await load({
        locals: makeAdminLocals(),
        params: { employeeId: 'emp-1' },
        depends: mockDepends,
      } as unknown as Parameters<typeof load>[0]);
      const elapsedMs = performance.now() - startTime;

      expect(mockGetEmployee).toHaveBeenCalledTimes(1);
      expect(mockListTokensForEmployee).toHaveBeenCalledTimes(1);
      expect(elapsedMs).toBeLessThan(15);
    });
  });
});

// ─── createToken action ───────────────────────────────────────────────────────

describe('createToken action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns token URL with role from employee (not from form)', async () => {
    mockCreateTokenForEmployee.mockResolvedValue({
      ok: true,
      value: { value: 'tok-abc', expiresAt: null },
    });

    const result = await actions.createToken({
      locals: makeAdminLocals(['cmp-1']),
      params: { employeeId: 'emp-1' },
      request: { formData: vi.fn() } as unknown as Request,
    } as Parameters<typeof actions['createToken']>[0]);

    expect((result as { success: boolean }).success).toBe(true);
    expect((result as { testUrl: string }).testUrl).toBe('http://localhost:5173/test/tok-abc');
    expect((result as { tokenValue: string }).tokenValue).toBe('tok-abc');
    // createTokenForEmployee receives companyId + employeeId + actorUid — no 'role' field
    expect(mockCreateTokenForEmployee).toHaveBeenCalledWith(
      expect.anything(),
      { companyId: 'cmp-1', employeeId: 'emp-1', actorUid: 'u1' }
    );
  });

  it('returns 404 when createTokenForEmployee returns 404 (cross-company employee)', async () => {
    mockCreateTokenForEmployee.mockResolvedValue({
      ok: false,
      status: 404,
      message: 'Employee not found',
    });

    const result = await actions.createToken({
      locals: makeAdminLocals(['cmp-1']),
      params: { employeeId: 'emp-other-company' },
      request: { formData: vi.fn() } as unknown as Request,
    } as Parameters<typeof actions['createToken']>[0]);

    expect((result as { status: number }).status).toBe(404);
  });

  it('returns 403 when user is unauthenticated', async () => {
    const result = await actions.createToken({
      locals: { user: null },
      params: { employeeId: 'emp-1' },
      request: { formData: vi.fn() } as unknown as Request,
    } as Parameters<typeof actions['createToken']>[0]);

    expect((result as { status: number }).status).toBe(403);
  });
});

// ─── revokeToken action ───────────────────────────────────────────────────────

describe('revokeToken action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds for a pending token', async () => {
    mockRevokeToken.mockResolvedValue({ ok: true, value: undefined });
    const formData = makeFormData({ tokenValue: 'tok-pending' });

    const result = await actions.revokeToken({
      locals: makeAdminLocals(['cmp-1']),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['revokeToken']>[0]);

    expect((result as { success: boolean }).success).toBe(true);
  });

  it('returns fail(400) with cannot_revoke_completed for completed token', async () => {
    mockRevokeToken.mockResolvedValue({
      ok: false,
      status: 400,
      message: 'cannot_revoke_completed',
    });
    const formData = makeFormData({ tokenValue: 'tok-done' });

    const result = await actions.revokeToken({
      locals: makeAdminLocals(['cmp-1']),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['revokeToken']>[0]);

    const resultData = result as { status: number; data: Record<string, string> };
    expect(resultData.status).toBe(400);
    expect(resultData.data.error).toBe('cannot_revoke_completed');
  });

  it('returns 422 when tokenValue is missing from form', async () => {
    const formData = makeFormData({});
    const result = await actions.revokeToken({
      locals: makeAdminLocals(['cmp-1']),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['revokeToken']>[0]);

    expect((result as { status: number }).status).toBe(422);
  });

  it('returns 403 when user is unauthenticated', async () => {
    const formData = makeFormData({ tokenValue: 'tok-1' });
    const result = await actions.revokeToken({
      locals: { user: null },
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['revokeToken']>[0]);

    expect((result as { status: number }).status).toBe(403);
  });
});
