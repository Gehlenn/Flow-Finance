import { describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  verifyFirebaseIdToken: vi.fn(),
  isFirebaseIdentityVerificationConfigured: vi.fn(),
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
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { AppError } from '../../src/middleware/errorHandler';
import { firebaseSessionController } from '../../src/controllers/authController';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.cookie = vi.fn(() => res);
  return res;
}

describe('authController Firebase session observability', () => {
  it('registra contexto ao falhar ao trocar Firebase idToken por sessão', async () => {
    controllerMocks.isFirebaseIdentityVerificationConfigured.mockReturnValue(true);
    controllerMocks.verifyFirebaseIdToken.mockRejectedValueOnce(new Error('invalid firebase token'));

    const req: any = {
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
