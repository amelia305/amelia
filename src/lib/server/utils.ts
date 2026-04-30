import type { Timestamp } from 'firebase-admin/firestore';

export function tsToDate(ts: Timestamp | null | undefined): Date | null {
  return ts?.toDate() ?? null;
}
