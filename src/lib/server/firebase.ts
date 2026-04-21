import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY
} from '$env/static/private';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // Firebase console exports private key with literal \n — replace before use.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

export const adminApp: App = getAdminApp();
export const adminDb: Firestore = getFirestore(adminApp);
