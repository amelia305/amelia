import { z } from 'zod';

// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'partner' | 'companyAdmin';

/** The three employee roles that map 1:1 to questionnaire profiles. */
export const ROLES = ['executive', 'middleManagement', 'operational'] as const;
export type Role = (typeof ROLES)[number];

export const RoleSchema = z.enum(ROLES);

export type TokenStatus = 'pending' | 'inProgress' | 'completed' | 'expired';

// ─── Locals ───────────────────────────────────────────────────────────────────

/** Populated into event.locals by hooks.server.ts after ID token verification. */
export interface LocalsUser {
  uid: string;
  email: string | null;
  role: UserRole;
  /** Present for partner role. By convention partnerUid === uid. */
  partnerUid?: string;
  /** Present for companyAdmin role. */
  companyIds?: string[];
}

// ─── Instrument ───────────────────────────────────────────────────────────────

export interface Question {
  /** e.g. "executive-p1-q3" */
  readonly id: string;
  readonly pillar: 1 | 2 | 3 | 4 | 5 | 6;
  readonly text: string;
  /** If true, invert score: 6 - value before summing. */
  readonly reverse: boolean;
}

export const QuestionSchema = z.object({
  id: z.string(),
  pillar: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  text: z.string().min(1),
  reverse: z.boolean(),
});

// ─── Answers ──────────────────────────────────────────────────────────────────

export interface Answer {
  readonly questionId: string;
  readonly value: 1 | 2 | 3 | 4 | 5;
}

export const AnswerSchema = z.object({
  questionId: z.string(),
  value: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

/** Zod schema for the hidden JSON input carrying all 42 answers. */
export const SubmitFormSchema = z.object({
  answers: z.array(AnswerSchema).length(42),
});

// ─── Token ────────────────────────────────────────────────────────────────────

export interface Token {
  readonly companyId: string;
  readonly employeeId: string;
  readonly role: Role;
  readonly status: TokenStatus;
  readonly createdAt: FirebaseFirestore.Timestamp;
  readonly expiresAt: FirebaseFirestore.Timestamp;
  readonly consumedAt?: FirebaseFirestore.Timestamp;
  readonly partialAnswers?: ReadonlyArray<Answer>;
}

/** Zod schema for token document data read from Firestore (Timestamps are plain objects at boundary). */
export const TokenSchema = z.object({
  companyId: z.string(),
  employeeId: z.string(),
  role: RoleSchema,
  status: z.enum(['pending', 'inProgress', 'completed', 'expired']),
  createdAt: z.unknown(),
  expiresAt: z.unknown(),
  consumedAt: z.unknown().optional(),
  partialAnswers: z.array(AnswerSchema).optional(),
});

// ─── Assessment ───────────────────────────────────────────────────────────────

export interface Assessment {
  readonly employeeId: string;
  readonly role: Role;
  readonly answers: ReadonlyArray<Answer>;
  readonly scoresByPillar: Readonly<Record<`p${1 | 2 | 3 | 4 | 5 | 6}`, number>>;
  readonly isme: number;
  readonly completedAt: FirebaseFirestore.Timestamp;
  readonly instrumentVersion: number;
}

export const ScoresByPillarSchema = z.object({
  p1: z.number(),
  p2: z.number(),
  p3: z.number(),
  p4: z.number(),
  p5: z.number(),
  p6: z.number(),
});

export const AssessmentSchema = z.object({
  employeeId: z.string(),
  role: RoleSchema,
  answers: z.array(AnswerSchema),
  scoresByPillar: ScoresByPillarSchema,
  isme: z.number(),
  completedAt: z.unknown(),
  instrumentVersion: z.number().int().positive(),
});

// ─── Company Stats ────────────────────────────────────────────────────────────

export interface RoleStats {
  readonly avgIsme: number;
  readonly count: number;
}

export interface CompanyStats {
  readonly weightedIsme: number;
  /** Must use Record<Role, ...> — NOT Record<string, ...> (Amendment 3). */
  readonly byRole: Readonly<Record<Role, RoleStats>>;
  readonly updatedAt: FirebaseFirestore.Timestamp;
}

export const RoleStatsSchema = z.object({
  avgIsme: z.number(),
  count: z.number().int().nonnegative(),
});

export const CompanyStatsSchema = z.object({
  weightedIsme: z.number(),
  byRole: z.object({
    executive: RoleStatsSchema,
    middleManagement: RoleStatsSchema,
    operational: RoleStatsSchema,
  }),
  updatedAt: z.unknown(),
});

// ─── Employee ─────────────────────────────────────────────────────────────────

export interface Employee {
  readonly name: string;
  readonly nationalId: string;
  readonly role: Role;
  readonly birthDate: string;
  readonly email: string;
  readonly gender: string;
  readonly tenureMonths: number;
  readonly activeToken?: string;
  readonly latestAssessmentId?: string;
  readonly createdAt: FirebaseFirestore.Timestamp;
  readonly createdBy: string;
}

export const EmployeeSchema = z.object({
  name: z.string().min(1),
  nationalId: z.string().min(1),
  role: RoleSchema,
  birthDate: z.string().min(1),
  email: z.string().email(),
  gender: z.string().min(1),
  tenureMonths: z.number().int().nonnegative(),
  activeToken: z.string().optional(),
  latestAssessmentId: z.string().optional(),
  createdAt: z.unknown(),
  createdBy: z.string(),
});

// ─── Company ──────────────────────────────────────────────────────────────────

export interface Company {
  readonly name: string;
  readonly partnerUid: string;
  readonly companyAdminUid: string;
  readonly createdAt: FirebaseFirestore.Timestamp;
  readonly createdBy: string;
  readonly stats?: CompanyStats;
}

export const CompanySchema = z.object({
  name: z.string().min(1),
  partnerUid: z.string(),
  companyAdminUid: z.string(),
  createdAt: z.unknown(),
  createdBy: z.string(),
  stats: CompanyStatsSchema.optional(),
});

// ─── Partner ──────────────────────────────────────────────────────────────────

export interface Partner {
  readonly name: string;
  readonly email: string;
  readonly createdAt: FirebaseFirestore.Timestamp;
  readonly createdBy: string;
}

export const PartnerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  createdAt: z.unknown(),
  createdBy: z.string(),
});
