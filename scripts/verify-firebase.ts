/**
 * Firebase connection verification script.
 *
 * Run:
 *   npx tsx scripts/verify-firebase.ts
 *
 * Requires .env file in project root with real Firebase credentials.
 * Do NOT commit this script's output — it may contain sensitive info.
 */

import 'dotenv/config';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const REQUIRED_PRIVATE = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
] as const;

const REQUIRED_PUBLIC = [
  'PUBLIC_FIREBASE_API_KEY',
  'PUBLIC_FIREBASE_AUTH_DOMAIN',
  'PUBLIC_FIREBASE_PROJECT_ID'
] as const;

function checkEnv(): boolean {
  let ok = true;
  console.log('Checking environment variables...\n');

  for (const key of REQUIRED_PRIVATE) {
    const val = process.env[key];
    if (!val || val.includes('placeholder') || val === 'your-project-id') {
      console.log(`  ❌ ${key} — missing or placeholder`);
      ok = false;
    } else {
      console.log(`  ✅ ${key} — set`);
    }
  }

  for (const key of REQUIRED_PUBLIC) {
    const val = process.env[key];
    if (!val || val.includes('placeholder') || val === 'your-project-id') {
      console.log(`  ❌ ${key} — missing or placeholder`);
      ok = false;
    } else {
      console.log(`  ✅ ${key} — set`);
    }
  }

  console.log();
  return ok;
}

async function verifyAdminSDK(): Promise<boolean> {
  console.log('Connecting to Firebase Admin SDK...\n');

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID!;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      console.log(
        '  ⚠️  FIREBASE_PRIVATE_KEY looks malformed. Did you paste the full key\n' +
          '     including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----?\n' +
          '     Make sure newlines in the .env are actual \\n escapes, not real line breaks.\n'
      );
      return false;
    }

    const app: App =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential: cert({ projectId, clientEmail, privateKey })
          });

    const db: Firestore = getFirestore(app);

    const testDocRef = db.collection('_verify').doc('connection');
    const timestamp = new Date().toISOString();

    await testDocRef.set({
      message: 'Firebase connection verified',
      timestamp,
      source: 'verify-firebase.ts'
    });

    const snapshot = await testDocRef.get();
    const data = snapshot.data();

    if (data?.timestamp === timestamp) {
      console.log(`  ✅ Write + read successful`);
      console.log(`     Document: _verify/connection`);
      console.log(`     Server timestamp: ${data.timestamp}\n`);
    } else {
      console.log(`  ❌ Read back data mismatch`);
      return false;
    }

    await testDocRef.delete();
    console.log(`  ✅ Cleanup complete (deleted _verify/connection)\n`);

    return true;
  } catch (err) {
    console.log(`  ❌ Admin SDK error:\n`);
    console.log('   ', err instanceof Error ? err.message : String(err));
    console.log();

    if (String(err).includes('invalid_grant')) {
      console.log(
        '     Hint: The service account key may be invalid or expired.\n' +
          '           Go to Firebase Console → Project Settings → Service Accounts →\n' +
          '           Generate new private key, and update FIREBASE_PRIVATE_KEY in .env\n'
      );
    }

    if (String(err).includes('invalid_grant') || String(err).includes('401')) {
      console.log(
        '     Hint: Check that FIREBASE_CLIENT_EMAIL matches the service account\n' +
          '           and FIREBASE_PROJECT_ID matches the project where the account lives.\n'
      );
    }

    return false;
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  Amelia — Firebase Verification');
  console.log('═══════════════════════════════════════\n');

  const envOk = checkEnv();
  if (!envOk) {
    console.log(
      'Fix your .env file first. Copy .env.example → .env and fill in real values.\n'
    );
    process.exit(1);
  }

  const adminOk = await verifyAdminSDK();
  if (!adminOk) {
    console.log('Admin SDK connection failed.\n');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════');
  console.log('  ✅ All checks passed');
  console.log('═══════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});