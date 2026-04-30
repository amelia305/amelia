import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  CompanySchema,
  AssessmentSchema,
  type CompanyStats,
  type Role,
  type RoleStats,
} from '$lib/types';
import { computeCompanyStats } from '$lib/server/scoring';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyWithId {
  id: string;
  name: string;
  companyAdminUid: string;
  partnerUid: string;
  stats?: Omit<CompanyStats, 'updatedAt'>;
}

export interface AssessmentSummary {
  id: string;
  employeeId: string;
  role: Role;
  isme: number;
  completedAt: unknown;
}

export interface CompanyDashboard {
  company: CompanyWithId;
  stats: Omit<CompanyStats, 'updatedAt'>;
  recentAssessments: AssessmentSummary[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const AssessmentRowSchema = AssessmentSchema.pick({
  employeeId: true,
  role: true,
  isme: true,
  completedAt: true,
});

/**
 * Pure function: reduces an array of assessments into CompanyStats using the
 * existing `computeCompanyStats` accumulator. Does NOT read from Firestore.
 */
export function recomputeCompanyStats(
  assessments: Array<{ role: Role; isme: number }>
): Omit<CompanyStats, 'updatedAt'> {
  if (assessments.length === 0) {
    const emptyRole: RoleStats = { avgIsme: 0, count: 0 };
    return {
      weightedIsme: 0,
      byRole: {
        executive: emptyRole,
        middleManagement: emptyRole,
        operational: emptyRole,
      },
    };
  }

  return assessments.reduce<Omit<CompanyStats, 'updatedAt'>>(
    (prev, assessment) => computeCompanyStats(prev, assessment),
    {
      weightedIsme: 0,
      byRole: {
        executive: { avgIsme: 0, count: 0 },
        middleManagement: { avgIsme: 0, count: 0 },
        operational: { avgIsme: 0, count: 0 },
      },
    }
  );
}

// ─── Firestore reads ──────────────────────────────────────────────────────────

/**
 * Fetch company docs for all companyIds the admin owns.
 * Silently skips IDs that do not exist or fail schema validation.
 */
export async function listCompaniesForAdmin(
  db: Firestore,
  companyIds: string[]
): Promise<CompanyWithId[]> {
  if (companyIds.length === 0) return [];

  const snaps = await Promise.all(
    companyIds.map((id) => db.collection('companies').doc(id).get())
  );

  const result: CompanyWithId[] = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const parsed = CompanySchema.safeParse(snap.data());
    if (!parsed.success) continue;
    const s = parsed.data.stats;
    result.push({
      id: snap.id,
      name: parsed.data.name,
      companyAdminUid: parsed.data.companyAdminUid,
      partnerUid: parsed.data.partnerUid,
      stats: s ? { weightedIsme: s.weightedIsme, byRole: s.byRole } : undefined,
    });
  }
  return result;
}

/**
 * Fetch all assessment docs for a company (subcollection).
 * Returns only the fields needed for stats + recent-assessment display.
 */
export async function listAssessmentsForCompany(
  db: Firestore,
  companyId: string
): Promise<AssessmentSummary[]> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('assessments')
    .orderBy('completedAt', 'desc')
    .get();

  const result: AssessmentSummary[] = [];
  for (const doc of snap.docs) {
    const parsed = AssessmentRowSchema.safeParse(doc.data());
    if (!parsed.success) continue;
    result.push({
      id: doc.id,
      employeeId: parsed.data.employeeId,
      role: parsed.data.role,
      isme: parsed.data.isme,
      completedAt: parsed.data.completedAt,
    });
  }
  return result;
}

/**
 * Fetch the N most recent assessment docs for a company using a server-side limit.
 */
export async function listRecentAssessmentsForCompany(
  db: Firestore,
  companyId: string,
  limit: number
): Promise<AssessmentSummary[]> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('assessments')
    .orderBy('completedAt', 'desc')
    .limit(limit)
    .get();

  const result: AssessmentSummary[] = [];
  for (const doc of snap.docs) {
    const parsed = AssessmentRowSchema.safeParse(doc.data());
    if (!parsed.success) continue;
    result.push({
      id: doc.id,
      employeeId: parsed.data.employeeId,
      role: parsed.data.role,
      isme: parsed.data.isme,
      completedAt: parsed.data.completedAt,
    });
  }
  return result;
}

/**
 * Build the dashboard payload for a single company.
 * Stats are read from the denormalized `company.stats` field (kept current by
 * `submitAssessment`). Only the N most recent assessments are fetched.
 */
export async function buildCompanyDashboard(
  db: Firestore,
  company: CompanyWithId,
  recentLimit = 10
): Promise<CompanyDashboard> {
  const recentAssessments = await listRecentAssessmentsForCompany(db, company.id, recentLimit);
  const stats = company.stats ?? recomputeCompanyStats([]);
  return { company, stats, recentAssessments };
}

// Partial schema used only for the companyId field existence check.
const _companyIdCheck = z.string().min(1);
void _companyIdCheck; // prevent unused-import lint noise
