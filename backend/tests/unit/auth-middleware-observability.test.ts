import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccessTokenFromRequest: vi.fn(),
  updateRequestContext: vi.fn(),
  loggerError: vi.fn(),
  loggerDebug: vi.fn(),
  loggerWarn: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('../../src/services/auth/authCookies', () => ({
  getAccessTokenFromRequest: mocks.getAccessTokenFromRequest,
}));

vi.mock('../../src/middleware/requestContextStore', () => ({
  updateRequestContext: mocks.updateRequestContext,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    debug: mocks.loggerDebug,
    warn: mocks.loggerWarn,
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/sentry', () => ({
  setUser: mocks.setUser,
  addBreadcrumb: mocks.addBreadcrumb,
}));

describe('auth middleware observability', () => {
  it('registra contexto quando authMiddleware falha ao extrair token', async () => {
    mocks.getAccessTokenFromRequest.mockImplementationOnce(() => {
      throw new Error('cookie parse failed');
    });

    const { authMiddleware } = await import('../../src/middleware/auth');

    const req: any = { requestId: 'req-1', routeScope: 'private' };
    const res: any = {
      status: vi.fn(() => res),
      json: vi.fn(),
    };
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        routeScope: 'private',
        fallback: 'auth-middleware-error',
      }),
      'Auth middleware error',
    );
  });

  it('registra contexto quando optionalAuthMiddleware falha ao extrair token', async () => {
    mocks.getAccessTokenFromRequest.mockImplementationOnce(() => {
      throw new Error('cookie parse failed');
    });

    const { optionalAuthMiddleware } = await import('../../src/middleware/auth');

    const req: any = { requestId: 'req-2', routeScope: 'public' };
    const res: any = {
      status: vi.fn(() => res),
      json: vi.fn(),
    };
    const next = vi.fn();

    optionalAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-2',
        routeScope: 'public',
        fallback: 'optional-auth-middleware-error',
      }),
      'Optional auth middleware error',
    );
  });
});
