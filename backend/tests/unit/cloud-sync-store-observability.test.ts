import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(),
  getFirestore: vi.fn(),
  applicationDefault: vi.fn(),
  cert: vi.fn(),
  applyFirestoreSettingsOnce: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: mocks.initializeApp,
  getApps: mocks.getApps,
  getFirestore: mocks.getFirestore,
  applicationDefault: mocks.applicationDefault,
  cert: mocks.cert,
}));

vi.mock('../../src/utils/firestoreAdmin', () => ({
  applyFirestoreSettingsOnce: mocks.applyFirestoreSettingsOnce,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('cloudSyncStore observability', () => {
  const originalProjectId = process.env.FIREBASE_PROJECT_ID;
  const originalClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const originalPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const originalApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  beforeEach(() => {
    vi.resetModules();
    mocks.initializeApp.mockReset();
    mocks.getApps.mockReset();
    mocks.getFirestore.mockReset();
    mocks.applicationDefault.mockReset();
    mocks.cert.mockReset();
    mocks.applyFirestoreSettingsOnce.mockReset();
    mocks.loggerError.mockReset();

    process.env.FIREBASE_PROJECT_ID = 'flow-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'flow@example.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    mocks.getApps.mockReturnValue([]);
    mocks.initializeApp.mockImplementation(() => {
      throw new Error('cloud sync firebase init failed');
    });
  });

  afterEach(() => {
    if (originalProjectId === undefined) {
      delete process.env.FIREBASE_PROJECT_ID;
    } else {
      process.env.FIREBASE_PROJECT_ID = originalProjectId;
    }

    if (originalClientEmail === undefined) {
      delete process.env.FIREBASE_CLIENT_EMAIL;
    } else {
      process.env.FIREBASE_CLIENT_EMAIL = originalClientEmail;
    }

    if (originalPrivateKey === undefined) {
      delete process.env.FIREBASE_PRIVATE_KEY;
    } else {
      process.env.FIREBASE_PRIVATE_KEY = originalPrivateKey;
    }

    if (originalApplicationCredentials === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = originalApplicationCredentials;
    }
  });

  it('registra contexto quando o Firebase Cloud Sync store falha ao inicializar', async () => {
    const { createCloudSyncStore } = await import('../../src/services/sync/cloudSyncStore');

    const store = createCloudSyncStore({ driver: 'firebase' });
    await expect(store.getStatus()).resolves.toEqual({
      driver: 'firebase',
      enabled: true,
      configured: true,
      ready: false,
    });

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'cloud sync firebase init failed',
        usingServiceAccount: true,
        usingApplicationDefault: false,
        configured: true,
        ready: false,
        fallback: 'firebase-cloud-sync-store-init-failed',
      }),
      'Failed to initialize Firebase Cloud Sync store',
    );
  });
});
