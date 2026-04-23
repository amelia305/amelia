import { Timestamp } from 'firebase-admin/firestore';
import type {
  Firestore,
  DocumentReference,
  Transaction,
} from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { TokenSchema, AnswerSchema } from '$lib/types';
import type { Answer } from '$lib/types';

export type TokenResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 404 | 410 | 500; message: string };

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
