import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock firebase ────────────────────────────────────────────────────────────
vi.mock('$lib/server/firebase', () => ({
  adminDb: {},
}));

// ─── Mock employees module ────────────────────────────────────────────────────
const { mockListEmployeesForCompany, mockCreateEmployee, mockArchiveEmployee } = vi.hoisted(() => ({
  mockListEmployeesForCompany: vi.fn(),
  mockCreateEmployee: vi.fn(),
  mockArchiveEmployee: vi.fn(),
}));

vi.mock('$lib/server/employees', () => ({
  listEmployeesForCompany: mockListEmployeesForCompany,
  createEmployee: mockCreateEmployee,
  archiveEmployee: mockArchiveEmployee,
}));

import { load, actions } from '../../../src/routes/(app)/empleados/+page.server';
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

function makeUrl(params: Record<string, string> = {}) {
  const sp = new URLSearchParams(params);
  return { searchParams: sp } as unknown as URL;
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

// ─── load ─────────────────────────────────────────────────────────────────────

describe('empleados load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns employees scoped to admin companyId', async () => {
    const employees = [
      { id: 'e1', name: 'Ana', email: 'ana@co.com', role: 'executive', archived: false },
    ];
    mockListEmployeesForCompany.mockResolvedValue(employees);

    const raw = await load({
      locals: makeAdminLocals(['cmp-1']),
      url: makeUrl(),
      depends: vi.fn(),
    } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { employees: Promise<unknown[]>; companyId: string };
    const resolvedEmployees = await result.employees;

    expect(resolvedEmployees).toEqual(employees);
    expect(result.companyId).toBe('cmp-1');
    expect(mockListEmployeesForCompany).toHaveBeenCalledWith(
      expect.anything(),
      'cmp-1',
      { showArchived: false }
    );
  });

  it('passes showArchived: true when ?showArchived=1', async () => {
    mockListEmployeesForCompany.mockResolvedValue([]);

    const raw2 = await load({
      locals: makeAdminLocals(['cmp-1']),
      url: makeUrl({ showArchived: '1' }),
      depends: vi.fn(),
    } as unknown as Parameters<typeof load>[0]);
    await (raw2 as unknown as { employees: Promise<unknown[]> }).employees;

    expect(mockListEmployeesForCompany).toHaveBeenCalledWith(
      expect.anything(),
      'cmp-1',
      { showArchived: true }
    );
  });

  it('returns empty employees when admin has no companyIds', async () => {
    const raw = await load({
      locals: makeAdminLocals([]),
      url: makeUrl(),
      depends: vi.fn(),
    } as unknown as Parameters<typeof load>[0]);
    const result = raw as unknown as { employees: Promise<unknown[]> | unknown[]; companyId: string };
    const resolvedEmployees = await Promise.resolve(result.employees);

    expect(resolvedEmployees).toEqual([]);
    expect(result.companyId).toBe('');
    expect(mockListEmployeesForCompany).not.toHaveBeenCalled();
  });

  it('throws 403 for non-adminEmpresa role', async () => {
    let thrownStatus: number | undefined;
    try {
      await load({
        locals: { user: { uid: 'p1', email: 'p@b.com', role: 'socio', companyIds: [] } },
        url: makeUrl(),
        depends: vi.fn(),
      } as unknown as Parameters<typeof load>[0]);
    } catch (e: unknown) {
      thrownStatus = (e as { status: number }).status;
    }
    expect(thrownStatus).toBe(403);
  });
});

// ─── createEmployee action ────────────────────────────────────────────────────

describe('createEmployee action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 when email is missing', async () => {
    const formData = makeFormData({ name: 'Test', email: '', role: 'executive' });
    const result = await actions.createEmployee({
      locals: makeAdminLocals(),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['createEmployee']>[0]);

    expect((result as { status: number }).status).toBe(422);
    expect(mockCreateEmployee).not.toHaveBeenCalled();
  });

  it('returns 422 when role is invalid', async () => {
    const formData = makeFormData({ name: 'Test', email: 'test@co.com', role: 'INVALID' });
    const result = await actions.createEmployee({
      locals: makeAdminLocals(),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['createEmployee']>[0]);

    expect((result as { status: number }).status).toBe(422);
  });

  it('returns 422 when name is empty', async () => {
    const formData = makeFormData({ name: '', email: 'test@co.com', role: 'executive' });
    const result = await actions.createEmployee({
      locals: makeAdminLocals(),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['createEmployee']>[0]);

    expect((result as { status: number }).status).toBe(422);
  });

  it('writes employee with companyId from locals, not from form body', async () => {
    mockCreateEmployee.mockResolvedValue({ id: 'new-emp-1' });
    const formData = makeFormData({
      name: 'María',
      email: 'maria@co.com',
      role: 'executive',
      nationalId: '123456',
      birthDate: '1990-01-01',
      gender: 'female',
      tenureMonths: '24',
      // form body does NOT contain companyId — must not be used
    });

    const result = await actions.createEmployee({
      locals: makeAdminLocals(['authoritative-cmp-id']),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['createEmployee']>[0]);

    expect((result as { success: boolean }).success).toBe(true);
    // companyId comes from locals, actorUid is the authenticated user's UID
    expect(mockCreateEmployee).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'María', email: 'maria@co.com' }),
      'authoritative-cmp-id',
      'u1'
    );
  });

  it('returns 403 when user is not adminEmpresa', async () => {
    const formData = makeFormData({ name: 'Test', email: 'test@co.com', role: 'executive' });
    const result = await actions.createEmployee({
      locals: { user: null },
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['createEmployee']>[0]);

    expect((result as { status: number }).status).toBe(403);
  });
});

// ─── archiveEmployee action ───────────────────────────────────────────────────

describe('archiveEmployee action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives the employee by ID with companyId from locals', async () => {
    mockArchiveEmployee.mockResolvedValue(undefined);
    const formData = makeFormData({ employeeId: 'emp-123' });

    const result = await actions.archiveEmployee({
      locals: makeAdminLocals(['cmp-1']),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['archiveEmployee']>[0]);

    expect((result as { success: boolean }).success).toBe(true);
    expect(mockArchiveEmployee).toHaveBeenCalledWith(
      expect.anything(),
      'emp-123',
      'cmp-1',
      'u1'
    );
  });

  it('returns 500 with error message when archiveEmployee throws (cross-company attempt)', async () => {
    mockArchiveEmployee.mockRejectedValue(new Error('Employee emp-bad not found in company cmp-1'));
    const formData = makeFormData({ employeeId: 'emp-bad' });

    const result = await actions.archiveEmployee({
      locals: makeAdminLocals(['cmp-1']),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['archiveEmployee']>[0]);

    expect((result as { status: number }).status).toBe(500);
  });

  it('returns 422 when employeeId is missing from form', async () => {
    const formData = makeFormData({});
    const result = await actions.archiveEmployee({
      locals: makeAdminLocals(['cmp-1']),
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['archiveEmployee']>[0]);

    expect((result as { status: number }).status).toBe(422);
  });

  it('returns 403 when user is unauthenticated', async () => {
    const formData = makeFormData({ employeeId: 'emp-1' });
    const result = await actions.archiveEmployee({
      locals: { user: null },
      request: { formData: () => Promise.resolve(formData) } as unknown as Request,
    } as Parameters<typeof actions['archiveEmployee']>[0]);

    expect((result as { status: number }).status).toBe(403);
  });
});
