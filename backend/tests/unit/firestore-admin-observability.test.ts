import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return {
    loggerMock,
    getAppsMock: vi.fn(),
    initializeAppMock: vi.fn(),
    getFirestoreMock: vi.fn(),
  };
});

vi.mock('firebase-admin/app', () => ({
  applicationDefault: vi.fn(() => ({ kind: 'applicationDefault' })),
  cert: vi.fn((value) => ({ kind: 'cert', value })),
  getApps: mocks.getAppsMock,
  initializeApp: mocks.initializeAppMock,
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mocks.getFirestoreMock,
}));

vi.mock('../../src/config/logger', () => ({
  default: mocks.loggerMock,
}));

import { getFirestoreOrNull, _resetFirestoreInstanceForTests } from '../../src/utils/firestoreAdmin';

describe('firestoreAdmin observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetFirestoreInstanceForTests();
    process.env.FIREBASE_PROJECT_ID = 'project-id';
    process.env.FIREBASE_CLIENT_EMAIL = 'service-account@example.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
    process.env.FIREBASE_DATABASE_URL = 'https://example.firebaseio.com';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
    mocks.getAppsMock.mockReturnValue([]);
    mocks.initializeAppMock.mockImplementation(() => {
      throw new Error('firestore init failed');
    });
  });

  it('registra contexto quando o bootstrap do Firestore falha e retorna null', async () => {
    const firestore = await getFirestoreOrNull('ClinicFireStore');

    expect(firestore).toBeNull();
    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'firestore init failed',
        callerLabel: 'ClinicFireStore',
        usingServiceAccount: true,
        hasGoogleApplicationCredentials: false,
        hasDatabaseUrl: true,
        fallback: 'firestore-init-failed',
      }),
      '[ClinicFireStore] Firestore init failed - using memory fallback',
    );
  });

  it('reusa a instancia do Firestore quando a inicializacao tem sucesso', async () => {
    const firestoreInstance = { settings: vi.fn() };

    mocks.initializeAppMock.mockReturnValue({ app: 'firestore-app' });
    mocks.getFirestoreMock.mockReturnValue(firestoreInstance);
    mocks.getAppsMock.mockReturnValue([]);

    const { getFirestoreOrNull } = await import('../../src/utils/firestoreAdmin');

    const firestore = await getFirestoreOrNull('ClinicFireStore');

    expect(firestore).toBe(firestoreInstance);
    expect(firestoreInstance.settings).toHaveBeenCalledWith({ ignoreUndefinedProperties: true });
    expect(mocks.loggerMock.error).not.toHaveBeenCalled();
  });
});
