import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { nanoid } from 'nanoid';

const TOKEN_EXPIRY_DAYS = Number(process.env['TOKEN_EXPIRY_DAYS'] ?? 30);

const projectId = process.env['FIREBASE_PROJECT_ID'];
const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
const rawKey = process.env['FIREBASE_PRIVATE_KEY'];
const seedAdminUidRaw = process.env['SEED_ADMIN_UID'];

if (!projectId || !clientEmail || !rawKey) {
  console.error('Missing required Firebase env vars. Copy .env.example to .env and fill in values.');
  process.exit(1);
}

if (!seedAdminUidRaw) {
  console.error('SEED_ADMIN_UID is required. Set it in .env to an existing Firebase Auth UID for the admin empresa account.');
  process.exit(1);
}

const SEED_ADMIN_UID: string = seedAdminUidRaw;

const privateKey = rawKey.replace(/\\n/g, '\n');

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const db = getFirestore(app);
const auth = getAuth(app);

const ROLES = ['executive', 'middleManagement', 'operational'] as const;
type Role = (typeof ROLES)[number];

const employees: Array<{
  role: Role;
  name: string;
  nationalId: string;
  email: string;
  gender: string;
  birthDate: string;
  tenureMonths: number;
}> = [
  {
    role: 'executive',
    name: 'Ana Torres',
    nationalId: '10000001',
    email: 'ana.torres@example.com',
    gender: 'female',
    birthDate: '1980-04-15',
    tenureMonths: 60,
  },
  {
    role: 'middleManagement',
    name: 'Carlos Ruiz',
    nationalId: '10000002',
    email: 'carlos.ruiz@example.com',
    gender: 'male',
    birthDate: '1988-09-22',
    tenureMonths: 36,
  },
  {
    role: 'operational',
    name: 'Maria Gomez',
    nationalId: '10000003',
    email: 'maria.gomez@example.com',
    gender: 'female',
    birthDate: '1995-01-30',
    tenureMonths: 12,
  },
];

async function generateTokenValue(): Promise<string> {
  for (let i = 0; i < 3; i++) {
    const value = nanoid(21);
    const snap = await db.collection('tokens').doc(value).get();
    if (!snap.exists) return value;
  }
  throw new Error('Could not generate unique token value after 3 attempts');
}

async function main(): Promise<void> {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(
    now.toMillis() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const companyRef = db.collection('companies').doc();
  const companyId = companyRef.id;

  const employeeRefs = employees.map(() =>
    db.collection('companies').doc(companyId).collection('employees').doc()
  );

  const tokenValues = await Promise.all(employees.map(() => generateTokenValue()));
  const tokenRefs = tokenValues.map((v) => db.collection('tokens').doc(v));

  const companyAuditRef = db.collection('companies').doc(companyId).collection('audit').doc();

  await db.runTransaction(async (t) => {
    t.set(companyRef, {
      name: 'Empresa Demo S.A.S.',
      partnerUid: 'seed-partner-uid',
      companyAdminUid: SEED_ADMIN_UID,
      createdAt: now,
      createdBy: 'seed-dev',
    });

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const empRef = employeeRefs[i];
      const tokenValue = tokenValues[i];

      t.set(empRef, {
        name: emp.name,
        nationalId: emp.nationalId,
        role: emp.role,
        birthDate: emp.birthDate,
        email: emp.email,
        gender: emp.gender,
        tenureMonths: emp.tenureMonths,
        activeToken: tokenValue,
        createdAt: now,
        createdBy: 'seed-dev',
      });

      t.set(tokenRefs[i], {
        companyId,
        employeeId: empRef.id,
        role: emp.role,
        status: 'pending',
        createdAt: now,
        expiresAt,
      });

      const tokenAuditRef = db
        .collection('companies')
        .doc(companyId)
        .collection('audit')
        .doc();

      t.set(tokenAuditRef, {
        action: 'token.created',
        actorUid: 'seed-dev',
        timestamp: now,
        meta: { tokenValue, employeeId: empRef.id, role: emp.role },
      });
    }

    t.set(companyAuditRef, {
      action: 'company.seeded',
      actorUid: 'seed-dev',
      timestamp: now,
      meta: { companyId, employeeCount: employees.length },
    });
  });

  // Set custom claims so the admin's next ID token carries role + companyIds.
  // The user must sign out and back in (or wait for token refresh) for the
  // new claim to appear in their session cookie.
  await auth.setCustomUserClaims(SEED_ADMIN_UID, {
    role: 'adminEmpresa',
    companyIds: [companyId],
  });

  console.log('\nSeed complete.');
  console.log(`  Company ID : ${companyId}`);
  console.log(`  Admin UID  : ${SEED_ADMIN_UID}`);
  console.log('  Custom claims set — sign out and back in to refresh the session.\n');
  console.log('Token URLs:');
  for (let i = 0; i < employees.length; i++) {
    console.log(`  [${employees[i].role}] http://localhost:5173/test/${tokenValues[i]}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error('Seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
