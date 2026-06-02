import { describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  rotateRefreshToken: vi.fn(),
  issueRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeUserRefreshTokens: vi.fn(),
  recordAuditEvent: vi.fn(),
  setAuthCookies: vi.fn(),
  getRefreshTokenFromRequest: vi.fn(),
  loggerError: vi.fn(),
  loggerDebug: vi.fn(),
}));

vi.mock('../../src/services/auth/refreshTokenStore', () => ({
  issueRefreshToken: controllerMocks.issueRefreshToken,
  rotateRefreshToken: controllerMocks.rotateRefreshToken,
  revokeRefreshToken: controllerMocks.revokeRefreshToken,
  revokeUserRefreshTokens: controllerMocks.revokeUserRefreshTokens,
}));

vi.mock('../../src/services/admin/auditLog', () => ({
  recordAuditEvent: controllerMocks.recordAuditEvent,
}));

vi.mock('../../src/services/auth/authCookies', () => ({
  clearAuthCookies: vi.fn(),
  getRefreshTokenFromRequest: controllerMocks.getRefreshTokenFromRequest,
  setAuthCookies: controllerMocks.setAuthCookies,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: controllerMocks.loggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: controllerMocks.loggerDebug,
  },
}));

import { AppError } from '../../src/middleware/errorHandler';
import { refreshController } from '../../src/controllers/authController';

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

function makeRes() {
  const res = {} as MockRes;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('authController refresh observability', () => {
  it('registra contexto ao falhar na rotação de refresh token', async () => {
    controllerMocks.getRefreshTokenFromRequest.mockReturnValue('refresh-token-123');
    controllerMocks.rotateRefreshToken.mockImplementation(() => {
      throw new Error('refresh token expired');
    });

    const req = {
      body: { refreshToken: 'refresh-token-123' },
      path: '/api/auth/refresh',
      ip: '127.0.0.1',
    };
    const res = makeRes();
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      refreshController(req, res, ((err?: unknown) => {
        next(err);
        resolve();
      }));
    });

    expect(next).toHaveBeenCalledTimes(1);
    const forwardedError = next.mock.calls[0][0];
    expect(forwardedError).toBeInstanceOf(AppError);
    expect((forwardedError as AppError).statusCode).toBe(401);
    expect(controllerMocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: undefined,
        hasRefreshToken: true,
        hasAuthorizationToken: false,
        refreshTokenLength: 17,
        fallback: 'auth-refresh-failed',
      }),
      'Refresh error',
    );
    expect(res.json).not.toHaveBeenCalled();
  });
});
