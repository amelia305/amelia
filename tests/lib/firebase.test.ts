import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn()
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null }))
}));

vi.mock('$env/static/public', () => ({
  PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  PUBLIC_FIREBASE_PROJECT_ID: 'test-project'
}));

describe('src/lib/firebase.ts', () => {
  it('exports app and auth without throwing', async () => {
    const { app, auth } = await import('../../src/lib/firebase');
    expect(app).toBeDefined();
    expect(auth).toBeDefined();
  });
});
