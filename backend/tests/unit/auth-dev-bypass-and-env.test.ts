import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccessTokenFromRequest: vi.fn(),
  updateRequestContext: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerDebug: vi.fn(),
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
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    debug: mocks.loggerDebug,
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/sentry', () => ({
  setUser: mocks.setUser,
  addBreadcrumb: mocks.addBreadcrumb,
}));

describe('auth dev bypass and env guards', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_DEV_BYPASS_TOKEN: process.env.AUTH_DEV_BYPASS_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('accepts only the explicit AUTH_DEV_BYPASS_TOKEN in test runtime', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_DEV_BYPASS_TOKEN = 'local-dev-bypass-token';
    mocks.getAccessTokenFromRequest.mockReturnValue('local-dev-bypass-token');

    const { authMiddleware } = await import('../../src/middleware/auth');

    const req = { requestId: 'req-auth-bypass', routeScope: 'test-route' } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { userId?: string }).userId).toBe('test-user');
    expect((req as Request & { userEmail?: string }).userEmail).toBe('test-user@local.test');
    expect(mocks.updateRequestContext).toHaveBeenCalledWith({
      userId: 'test-user',
      userEmail: 'test-user@local.test',
    });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-auth-bypass',
        routeScope: 'test-route',
        fallback: 'auth-dev-bypass-active',
      }),
      'INSECURE DEV LOGIN bypass token used',
    );
  });

  it('blocks backend boot when AUTH_DEV_BYPASS_TOKEN is set in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '12345678901234567890123456789012';
    process.env.AUTH_DEV_BYPASS_TOKEN = 'should-not-boot';

    await expect(import('../../src/config/env')).rejects.toThrow(
      'AUTH_DEV_BYPASS_TOKEN must be unset in production',
    );
  });
});
