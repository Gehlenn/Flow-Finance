import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { logWarnMock } = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: logWarnMock,
}));

describe('firebase config observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    logWarnMock.mockReset();
    vi.stubEnv('VITE_FIREBASE_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('VITE_FIREBASE_APP_ID', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registra aviso quando Firebase web nao esta configurado', async () => {
    const module = await import('../../services/firebase');

    expect(module.isFirebaseConfigured).toBe(false);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[Firebase] Web auth/Firestore disabled',
      expect.objectContaining({
        missingFirebaseConfigKeys: expect.arrayContaining([
          'VITE_FIREBASE_API_KEY',
          'VITE_FIREBASE_AUTH_DOMAIN',
          'VITE_FIREBASE_PROJECT_ID',
          'VITE_FIREBASE_APP_ID',
        ]),
      }),
      expect.objectContaining({
        fallback: 'firebase-web-auth-firestore-disabled',
      }),
    );
  });
});
