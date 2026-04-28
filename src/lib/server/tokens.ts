import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type {
  Firestore,
  DocumentReference,
  Transaction,
} from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { TokenSchema, AnswerSchema, RoleSchema } from '$lib/types';
import type { Answer, Role, TokenStatus } from '$lib/types';
import { TOKEN_EXPIRY_DAYS } from '$env/static/private';

export type TokenResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 410 | 500; message: string };

const ActiveTokenSchema = TokenSchema.extend({
  expiresAt: z.instanceof(Timestamp),
  createdAt: z.instanceof(Timestamp),
  consumedAt: z.instanceof(Timestamp).optional(),
  partialAnswers: z.array(AnswerSchema).optional(),
});

type ActiveToken = z.infer<typeof ActiveTokenSchema>;

export async function readActiveToken(
  db: Firestore,
  tokenValue: string
): Promise<TokenResult<{ ref: DocumentReference; data: ActiveToken }>> {
  const ref = db.collection('tokens').doc(tokenValue);
  const snap = await ref.get();

  if (!snap.exists) {
    return { ok: false, status: 404, message: `Token not found: ${tokenValue}` };
  }

  const parsed = ActiveTokenSchema.safeParse(snap.data());
  if (!parsed.success) {
    return { ok: false, status: 500, message: 'Token document schema mismatch' };
  }

  const data = parsed.data;

  if (data.status === 'completed' || data.status === 'expired') {
    return { ok: false, status: 410, message: `Token is ${data.status}` };
  }

  if (data.expiresAt.toMillis() < Date.now()) {
    return { ok: false, status: 410, message: 'Token has expired' };
  }

  return { ok: true, value: { ref, data } };
}

const TokenProgressSchema = z.object({
  role: z.enum(['executive', 'middleManagement', 'operational']),
  status: z.enum(['pending', 'inProgress', 'completed', 'expired']),
  partialAnswers: z.array(AnswerSchema).optional(),
});

export async function saveInProgressAnswers(
  db: Firestore,
  tokenValue: string,
  pillar: 1 | 2 | 3 | 4 | 5 | 6,
  pillarAnswers: readonly Answer[]
): Promise<TokenResult<void>> {
  const ref = db.collection('tokens').doc(tokenValue);
  const snap = await ref.get();

  if (!snap.exists) {
    return { ok: false, status: 404, message: `Token not found: ${tokenValue}` };
  }

  const parsed = TokenProgressSchema.safeParse(snap.data());
  if (!parsed.success) {
    return { ok: false, status: 500, message: 'Token document schema mismatch' };
  }

  const { status, role, partialAnswers: existing } = parsed.data;

  if (status === 'completed' || status === 'expired') {
    return { ok: false, status: 410, message: `Cannot save progress — token is ${status}` };
  }

  // Merge: keep entries for other pillars, replace entries for the incoming pillar.
  const pillarPrefix = `${role}-p${pillar}-`;
  const otherPillarsAnswers = (existing ?? []).filter(
    (a) => !a.questionId.startsWith(pillarPrefix)
  );
  const merged = [...otherPillarsAnswers, ...pillarAnswers];

  await ref.update({
    status: 'inProgress',
    partialAnswers: merged,
  });

  return { ok: true, value: undefined };
}

export function markTokenCompleted(
  t: Transaction,
  tokenRef: DocumentReference,
  consumedAt: Timestamp
): void {
  t.update(tokenRef, {
    status: 'completed',
    consumedAt,
  });
}

export async function generateUniqueTokenValue(
  db: Firestore,
  maxAttempts = 3
): Promise<TokenResult<string>> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const value = nanoid(21);
    const snap = await db.collection('tokens').doc(value).get();
    if (!snap.exists) {
      return { ok: true, value };
    }
  }
  return {
    ok: false,
    status: 500,
    message: `Failed to generate unique token after ${maxAttempts} attempts`,
  };
}

// ─── Phase 2: Admin Empresa token management ──────────────────────────────────

const TokenExpiryDays = Math.max(1, Number(TOKEN_EXPIRY_DAYS) || 30);

export interface CreateTokenResult {
  value: string;
  expiresAt: Timestamp;
}

/**
 * Generate a new pending token for an employee atomically:
 *   1. read employee (for role + any existing activeToken)
 *   2. if a prior activeToken is still pending/inProgress, expire it
 *   3. write new token doc
 *   4. update employees/{id}.activeToken
 *   5. write audit
 *
 * `role` comes from the employee doc — never from form input. `companyId` comes
 * from `locals.user.companyIds[0]`, never from the request body.
 */
export async function createTokenForEmployee(
  db: Firestore,
  params: { companyId: string; employeeId: string; actorUid: string }
): Promise<TokenResult<CreateTokenResult>> {
  // Generate a unique token value BEFORE the transaction (reads against tokens/
  // collection are needed for uniqueness, and unbounded reads inside a
  // transaction are wasteful).
  const tokenResult = await generateUniqueTokenValue(db);
  if (!tokenResult.ok) return tokenResult;
  const tokenValue = tokenResult.value;

  const employeeRef = db
    .collection('companies')
    .doc(params.companyId)
    .collection('employees')
    .doc(params.employeeId);
  const newTokenRef = db.collection('tokens').doc(tokenValue);
  const auditRef = db.collection('companies').doc(params.companyId).collection('audit').doc();

  return db.runTransaction(async (t): Promise<TokenResult<CreateTokenResult>> => {
    const empSnap = await t.get(employeeRef);
    if (!empSnap.exists) {
      return { ok: false, status: 404, message: 'Employee not found' };
    }
    const empData = empSnap.data() as Record<string, unknown>;
    const roleParsed = RoleSchema.safeParse(empData['role']);
    if (!roleParsed.success) {
      return { ok: false, status: 500, message: 'Employee has invalid role' };
    }
    const role: Role = roleParsed.data;

    // If a prior active token exists, expire it inside the same transaction so
    // the read+write avoids lost updates under contention.
    const priorActive = empData['activeToken'];
    if (typeof priorActive === 'string' && priorActive.length > 0) {
      const priorRef = db.collection('tokens').doc(priorActive);
      const priorSnap = await t.get(priorRef);
      if (priorSnap.exists) {
        const priorStatus = String(priorSnap.data()?.['status'] ?? '');
        if (priorStatus === 'pending' || priorStatus === 'inProgress') {
          t.update(priorRef, { status: 'expired' });
        }
      }
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(
      now.toMillis() + TokenExpiryDays * 24 * 60 * 60 * 1000
    );

    t.set(newTokenRef, {
      companyId: params.companyId,
      employeeId: params.employeeId,
      role,
      status: 'pending',
      createdAt: now,
      expiresAt,
    });

    t.update(employeeRef, { activeToken: tokenValue });

    t.set(auditRef, {
      action: 'token.created',
      actorUid: params.actorUid,
      timestamp: now,
      meta: {
        tokenValue,
        employeeId: params.employeeId,
        role,
        replacedToken: typeof priorActive === 'string' ? priorActive : null,
      },
    });

    return { ok: true, value: { value: tokenValue, expiresAt } };
  });
}

/**
 * List all tokens for an employee (scoped to companyId for safety).
 */
export async function listTokensForEmployee(
  db: Firestore,
  employeeId: string,
  companyId: string
): Promise<Array<{ value: string; status: string; createdAt: unknown; expiresAt: unknown }>> {
  const snap = await db
    .collection('tokens')
    .where('employeeId', '==', employeeId)
    .where('companyId', '==', companyId)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      value: doc.id,
      status: String(d['status'] ?? 'unknown'),
      createdAt: d['createdAt'].toDate(),
      expiresAt: d['expiresAt'].toDate(),
    };
  });
}

// ─── Phase 3: Public token index table ────────────────────────────────────────

export interface RecentToken {
  value: string;
  status: TokenStatus;
  role: Role;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * List at most 5 recent valid tokens for the public index page.
 *
 * Queries the tokens collection for documents with status 'pending' or
 * 'inProgress', ordered by createdAt descending (limit 10), then filters out
 * any that have already expired client-side and slices the result to 5.
 *
 * This query requires a composite index on tokens(status ASC, createdAt DESC)
 * that must be created manually or via firestore.indexes.json.
 */
export async function listRecentValidTokens(db: Firestore): Promise<RecentToken[]> {
  const snap = await db
    .collection('tokens')
    .where('status', 'in', ['pending', 'inProgress'])
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const now = Date.now();

  const valid = snap.docs.filter((doc) => {
    const data = doc.data();
    const expiresAt = data['expiresAt'];
    if (!expiresAt || typeof expiresAt.toMillis !== 'function') return false;
    return expiresAt.toMillis() > now;
  });

  return valid.slice(0, 5).map((doc) => {
    const d = doc.data();
    return {
      value: doc.id,
      status: d['status'] as TokenStatus,
      role: d['role'] as Role,
      createdAt: d['createdAt'].toDate(),
      expiresAt: d['expiresAt'].toDate(),
    };
  });
}

/**
 * Revoke a token atomically: flip status to 'expired', clear
 * `employees/{id}.activeToken` if it still references this token, and write an
 * audit entry. Completed tokens are immutable audit records — attempting to
 * revoke one returns `fail(400)`. Already-expired tokens are an idempotent
 * no-op (no audit re-write).
 */
export async function revokeToken(
  db: Firestore,
  tokenValue: string,
  companyId: string,
  actorUid: string
): Promise<TokenResult<void>> {
  const tokenRef = db.collection('tokens').doc(tokenValue);

  return db.runTransaction(async (t): Promise<TokenResult<void>> => {
    const tokenSnap = await t.get(tokenRef);
    if (!tokenSnap.exists) {
      return { ok: false, status: 404, message: 'Token not found' };
    }

    const data = tokenSnap.data() as Record<string, unknown>;
    if (data['companyId'] !== companyId) {
      return { ok: false, status: 404, message: 'Token not found' };
    }

    const status = String(data['status'] ?? '');
    if (status === 'completed') {
      return { ok: false, status: 400, message: 'cannot_revoke_completed' };
    }
    if (status === 'expired') {
      return { ok: true, value: undefined };
    }

    const employeeId = String(data['employeeId'] ?? '');
    const employeeRef = employeeId
      ? db.collection('companies').doc(companyId).collection('employees').doc(employeeId)
      : null;

    let clearActiveToken = false;
    if (employeeRef) {
      const empSnap = await t.get(employeeRef);
      if (empSnap.exists && empSnap.data()?.['activeToken'] === tokenValue) {
        clearActiveToken = true;
      }
    }

    const now = Timestamp.now();
    t.update(tokenRef, { status: 'expired' });
    if (clearActiveToken && employeeRef) {
      t.update(employeeRef, { activeToken: FieldValue.delete() });
    }

    const auditRef = db.collection('companies').doc(companyId).collection('audit').doc();
    t.set(auditRef, {
      action: 'token.revoked',
      actorUid,
      timestamp: now,
      meta: { tokenValue, employeeId, priorStatus: status },
    });

    return { ok: true, value: undefined };
  });
}
