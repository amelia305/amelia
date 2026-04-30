import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { EmployeeSchema, RoleSchema, type Role } from '$lib/types';
import { tsToDate } from './utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  activeToken?: string;
  archived: boolean;
  latestAssessmentId?: string;
  latestIsme?: number | null;
  latestCompletedAt?: Date | null;
}

export interface EmployeeDetail extends EmployeeRow {
  nationalId: string;
  birthDate: string;
  gender: string;
  tenureMonths: number;
}

// Extend the canonical schema to include the `archived` soft-delete flag.
const EmployeeDocSchema = EmployeeSchema.extend({
  archived: z.boolean().optional(),
});

const CreateEmployeeInputSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  email: z.string().email('Correo inválido'),
  role: RoleSchema,
  nationalId: z.string().min(1, 'Cédula requerida'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  gender: z.enum(['male', 'female'], { required_error: 'Género requerido' }),
  tenureMonths: z.coerce.number().int().nonnegative('Debe ser 0 o más'),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeInputSchema>;

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ListOptions {
  showArchived?: boolean;
}

/**
 * List employees for a single company. Filters out archived employees unless
 * `opts.showArchived` is true. `companyId` is always the authoritative scope —
 * never accepted from user input.
 */
export async function listEmployeesForCompany(
  db: Firestore,
  companyId: string,
  opts: ListOptions = {}
): Promise<EmployeeRow[]> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('employees')
    .orderBy('createdAt', 'desc')
    .get();

  const rows: EmployeeRow[] = [];
  for (const doc of snap.docs) {
    const parsed = EmployeeDocSchema.safeParse(doc.data());
    if (!parsed.success) continue;
    const archived = parsed.data.archived ?? false;
    if (archived && !opts.showArchived) continue;
    rows.push({
      id: doc.id,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      activeToken: parsed.data.activeToken,
      latestAssessmentId: parsed.data.latestAssessmentId,
      latestIsme: parsed.data.latestIsme ?? null,
      latestCompletedAt: tsToDate(parsed.data.latestCompletedAt as Timestamp | null),
      archived,
    });
  }

  return rows;
}

/**
 * Get a single employee by ID, scoped to companyId. Returns null if not found
 * or if the employee belongs to a different company (cross-company guard).
 */
export async function getEmployee(
  db: Firestore,
  employeeId: string,
  companyId: string
): Promise<EmployeeDetail | null> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('employees')
    .doc(employeeId)
    .get();

  if (!snap.exists) return null;

  const parsed = EmployeeDocSchema.safeParse(snap.data());
  if (!parsed.success) return null;

  return {
    id: snap.id,
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    nationalId: parsed.data.nationalId,
    birthDate: parsed.data.birthDate,
    gender: parsed.data.gender,
    tenureMonths: parsed.data.tenureMonths,
    activeToken: parsed.data.activeToken,
    latestAssessmentId: parsed.data.latestAssessmentId,
    latestIsme: parsed.data.latestIsme ?? null,
    latestCompletedAt: tsToDate(parsed.data.latestCompletedAt as Timestamp | null),
    archived: parsed.data.archived ?? false,
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Validate input and create an employee document atomically with an audit
 * entry. `companyId` is passed separately from `input` — it MUST come from
 * `locals.user.companyIds[0]`, never from form data. `actorUid` is the
 * authenticated user's UID (used for audit attribution and `createdBy`).
 */
export async function createEmployee(
  db: Firestore,
  input: unknown,
  companyId: string,
  actorUid: string
): Promise<{ id: string }> {
  const parsed = CreateEmployeeInputSchema.parse(input);
  const now = Timestamp.now();

  const employeeRef = db.collection('companies').doc(companyId).collection('employees').doc();
  const auditRef = db.collection('companies').doc(companyId).collection('audit').doc();

  await db.runTransaction(async (t) => {
    t.set(employeeRef, {
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      nationalId: parsed.nationalId,
      birthDate: parsed.birthDate,
      gender: parsed.gender,
      tenureMonths: parsed.tenureMonths,
      createdAt: now,
      createdBy: actorUid,
    });
    t.set(auditRef, {
      action: 'employee.created',
      actorUid,
      timestamp: now,
      meta: { employeeId: employeeRef.id, role: parsed.role },
    });
  });

  return { id: employeeRef.id };
}

// ─── Archive (soft delete) ────────────────────────────────────────────────────

/**
 * Soft-delete an employee by setting `archived: true`. Hard delete is forbidden
 * — assessments reference employeeId and a hard delete would orphan history.
 * Atomic with an audit write. The `companyId` param ensures cross-company
 * writes are impossible: the doc reference is scoped to
 * `companies/{companyId}/employees/{employeeId}`.
 */
export async function archiveEmployee(
  db: Firestore,
  employeeId: string,
  companyId: string,
  actorUid: string
): Promise<void> {
  const employeeRef = db
    .collection('companies')
    .doc(companyId)
    .collection('employees')
    .doc(employeeId);
  const auditRef = db.collection('companies').doc(companyId).collection('audit').doc();

  await db.runTransaction(async (t) => {
    const snap = await t.get(employeeRef);
    if (!snap.exists) {
      throw new Error(`Employee ${employeeId} not found in company ${companyId}`);
    }
    const now = Timestamp.now();
    t.update(employeeRef, { archived: true });
    t.set(auditRef, {
      action: 'employee.archived',
      actorUid,
      timestamp: now,
      meta: { employeeId },
    });
  });
}
