import { describe, it, expect, vi } from 'vitest';

const mockApp = { name: '[DEFAULT]' };
const mockDb = { collection: vi.fn() };

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(() => mockApp),
  getApps: vi.fn(() => []),
  cert: vi.fn((config) => config)
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb)
}));

vi.mock('$env/static/private', () => ({
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n'
}));

describe('src/lib/server/firebase.ts', () => {
  it('exports adminApp and adminDb without throwing', async () => {
    const { adminApp, adminDb } = await import('../../../src/lib/server/firebase');
    expect(adminApp).toBeDefined();
    expect(adminDb).toBeDefined();
  });

  it('replaces \\n in private key before passing to cert', async () => {
    const { cert } = await import('firebase-admin/app');
    expect(cert).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKey: expect.stringContaining('\n')
      })
    );
  });
});
