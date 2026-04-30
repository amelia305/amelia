/**
 * Backfill latestIsme and latestCompletedAt onto employee docs.
 *
 * Run once before deploying perf-denorm-and-single-empresa Phase 2.
 * Idempotent — safe to re-run. Skips employees where latestIsme is already
 * present. If the script fails mid-run, re-running is always safe.
 *
 * Deploy gate (ADR-003): Phase 2 of perf-denorm-and-single-empresa MUST NOT
 * be deployed until this script has been run and verified against the target
 * environment. After running, confirm: 0 employees have latestAssessmentId
 * but are missing latestIsme.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... \
 *   SEED_ADMIN_UID=<uid> pnpm tsx scripts/backfill-latest-isme.ts
 */

import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const projectId = process.env['FIREBASE_PROJECT_ID'];
const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
const rawKey = process.env['FIREBASE_PRIVATE_KEY'];
const seedAdminUid = process.env['SEED_ADMIN_UID'];

if (!projectId || !clientEmail || !rawKey) {
  console.error(
    'Missing required Firebase env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).',
  );
  process.exit(1);
}

if (!seedAdminUid) {
  console.error(
    'SEED_ADMIN_UID is required. Set it in .env to verify you intend to run this against the correct environment.',
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: rawKey.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function run(): Promise<void> {
  let companiesProcessed = 0;
  let employeesSkipped = 0;
  let employeesPatched = 0;
  let employeesMissingAssessment = 0;
  let errors = 0;

  const companiesSnap = await db.collection('companies').get();
  console.log(`Found ${companiesSnap.size} companies.`);

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    companiesProcessed++;

    const employeesSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('employees')
      .get();

    for (const employeeDoc of employeesSnap.docs) {
      const data = employeeDoc.data();
      const employeeId = employeeDoc.id;

      // Idempotent guard: skip if denorm field already present.
      if (data['latestIsme'] !== undefined && data['latestIsme'] !== null) {
        employeesSkipped++;
        continue;
      }

      const latestAssessmentId = data['latestAssessmentId'] as string | undefined;
      if (!latestAssessmentId) {
        // No completed assessment — nothing to backfill.
        employeesSkipped++;
        continue;
      }

      // Read the assessment doc to get isme and completedAt.
      const assessmentSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('assessments')
        .doc(latestAssessmentId)
        .get();

      if (!assessmentSnap.exists) {
        console.warn(
          `  [WARN] company=${companyId} employee=${employeeId}: assessment ${latestAssessmentId} not found — skipping.`,
        );
        employeesMissingAssessment++;
        continue;
      }

      const assessmentData = assessmentSnap.data()!;
      const isme = assessmentData['isme'] as number | undefined;
      const completedAt = assessmentData['completedAt'];

      if (typeof isme !== 'number' || !(completedAt instanceof Timestamp)) {
        console.warn(
          `  [WARN] company=${companyId} employee=${employeeId}: assessment ${latestAssessmentId} has invalid isme or completedAt — skipping.`,
        );
        errors++;
        continue;
      }

      await db
        .collection('companies')
        .doc(companyId)
        .collection('employees')
        .doc(employeeId)
        .update({ latestIsme: isme, latestCompletedAt: completedAt });

      employeesPatched++;
      console.log(
        `  [PATCH] company=${companyId} employee=${employeeId}: latestIsme=${isme}`,
      );
    }
  }

  console.log('\n=== Backfill complete ===');
  console.log(`Companies processed : ${companiesProcessed}`);
  console.log(`Employees patched   : ${employeesPatched}`);
  console.log(`Employees skipped   : ${employeesSkipped}`);
  console.log(`Missing assessments : ${employeesMissingAssessment}`);
  console.log(`Errors              : ${errors}`);

  if (errors > 0 || employeesMissingAssessment > 0) {
    console.error(
      '\nBackfill completed with unresolved entries. Review warnings above and resolve before deploying Phase 2.',
    );
    process.exit(1);
  }

  console.log(
    '\nVerification: confirm 0 employees have latestAssessmentId but are missing latestIsme before deploying Phase 2.',
  );
}

run().catch((err: unknown) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
