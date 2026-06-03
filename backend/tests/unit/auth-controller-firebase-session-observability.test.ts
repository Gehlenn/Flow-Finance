import { describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  verifyFirebaseIdToken: vi.fn(),
  isFirebaseIdentityVerificationConfigured: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('../../src/services/auth/firebaseIdentityService', () => ({
  verifyFirebaseIdToken: controllerMocks.verifyFirebaseIdToken,
  isFirebaseIdentityVerificationConfigured: controllerMocks.isFirebaseIdentityVerificationConfigured,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: controllerMocks.loggerError,
    info: vi.fn(),
    warn: controllerMocks.loggerWarn,
    debug: vi.fn(),
  },
}));

import { AppError } from '../../src/middleware/errorHandler';
import { firebaseSessionController } from '../../src/controllers/authController';

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  cookie: ReturnType<typeof vi.fn>;
};

function makeRes() {
  const res = {} as MockRes;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.cookie = vi.fn(() => res);
  return res;
}

describe('authController Firebase session observability', () => {
  it('registra contexto quando a verificacao Firebase nao esta configurada', async () => {
    controllerMocks.isFirebaseIdentityVerificationConfigured.mockReturnValue(false);

    const req = {
      path: '/api/auth/firebase',
      body: { idToken: 'firebase-id-token-123' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'vitest' },
    };
    const res = makeRes();
    const next = vi.fn();

    firebaseSessionController(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    const forwardedError = next.mock.calls[0][0];
    expect(forwardedError).toBeInstanceOf(AppError);
    expect(forwardedError.statusCode).toBe(503);
    expect(controllerMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/auth/firebase',
        ip: '127.0.0.1',
        hasIdToken: true,
        idTokenLength: 21,
        firebaseConfigured: false,
        fallback: 'firebase-session-misconfigured',
      }),
      'Firebase session exchange unavailable: backend not configured',
    );
    expect(controllerMocks.verifyFirebaseIdToken).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('registra contexto ao falhar ao trocar Firebase idToken por sessao', async () => {
    controllerMocks.isFirebaseIdentityVerificationConfigured.mockReturnValue(true);
    controllerMocks.verifyFirebaseIdToken.mockRejectedValueOnce(new Error('invalid firebase token'));

    const req = {
      path: '/api/auth/firebase',
      body: { idToken: 'firebase-id-token-123' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'vitest' },
    };
    const res = makeRes();
    const next = vi.fn();

    firebaseSessionController(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    const forwardedError = next.mock.calls[0][0];
    expect(forwardedError).toBeInstanceOf(AppError);
    expect(forwardedError.statusCode).toBe(401);
    expect(controllerMocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/auth/firebase',
        ip: '127.0.0.1',
        hasIdToken: true,
        idTokenLength: 21,
        firebaseConfigured: true,
        fallback: 'firebase-session-exchange-failed',
      }),
      'Firebase session exchange error',
    );
    expect(res.json).not.toHaveBeenCalled();
  });
});
