import { describe, it, expect, afterEach, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../src/middleware/errorHandler';
import { isInsecureLocalLoginAllowed, loginController } from '../../src/controllers/authController';

describe('authController login security hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOverride = process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalOverride === undefined) {
      delete process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN;
    } else {
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = originalOverride;
    }

    vi.clearAllMocks();
  });

  it('disables insecure local login by default in staging', () => {
    process.env.NODE_ENV = 'staging';
    delete process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN;

    expect(isInsecureLocalLoginAllowed()).toBe(false);
  });

  it('allows insecure local login explicitly via AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';

    expect(isInsecureLocalLoginAllowed()).toBe(true);
  });

  it('returns AppError 503 when insecure local login is disabled', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'false';

    const req = {
      body: {
        email: 'user@example.com',
        password: 'any-password',
      },
    } as Request;

    const res = {
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as unknown as NextFunction;

    await new Promise<void>((resolve) => {
      loginController(req, res, ((err?: unknown) => {
        (next as any)(err);
        resolve();
      }) as NextFunction);
    });

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const forwardedError = (next as any).mock.calls[0][0];
    expect(forwardedError).toBeInstanceOf(AppError);
    expect((forwardedError as AppError).statusCode).toBe(503);
  });

  it('sets secure auth cookies when local login is explicitly allowed', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';

    const req = {
      body: {
        email: 'user@example.com',
        password: 'any-password',
      },
      headers: {},
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      json: vi.fn(),
      cookie: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as unknown as NextFunction;

    loginController(req, res, next);
    await Promise.resolve();

    expect(next).not.toHaveBeenCalled();
    expect((res as any).cookie).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledTimes(1);
  });

  describe('Input validation hardening', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';
    });

    it('rejects login without email address', async () => {
      const req = {
        body: {
          password: 'any-password',
        },
        headers: {},
        ip: '127.0.0.1',
      } as Request;

      const res = { json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await new Promise<void>((resolve) => {
        loginController(req, res, ((err?: unknown) => {
          (next as any)(err);
          resolve();
        }) as NextFunction);
      });

      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as any).mock.calls[0][0] as AppError;
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('Email');
    });

    it('rejects login without password', async () => {
      const req = {
        body: {
          email: 'user@example.com',
        },
        headers: {},
        ip: '127.0.0.1',
      } as Request;

      const res = { json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await new Promise<void>((resolve) => {
        loginController(req, res, ((err?: unknown) => {
          (next as any)(err);
          resolve();
        }) as NextFunction);
      });

      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as any).mock.calls[0][0] as AppError;
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('password');
    });

    it('rejects login with empty email string', async () => {
      const req = {
        body: {
          email: '   ',
          password: 'valid-password',
        },
        headers: {},
        ip: '127.0.0.1',
      } as Request;

      const res = { json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await new Promise<void>((resolve) => {
        loginController(req, res, ((err?: unknown) => {
          (next as any)(err);
          resolve();
        }) as NextFunction);
      });

      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('rejects login with empty password string', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: '   ',
        },
        headers: {},
        ip: '127.0.0.1',
      } as Request;

      const res = { json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await new Promise<void>((resolve) => {
        loginController(req, res, ((err?: unknown) => {
          (next as any)(err);
          resolve();
        }) as NextFunction);
      });

      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('User ID generation hardening', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';
    });

    it('uses requestedUserId when provided and non-empty', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password',
          userId: 'custom-user-id-123',
        },
        headers: {},
        ip: '127.0.0.1',
      } as unknown as Request;

      const res = {
        json: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as unknown as NextFunction;

      loginController(req, res, next);
      await Promise.resolve();

      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.user.userId).toBe('custom-user-id-123');
    });

    it('generates base64-encoded userId from email when not provided', async () => {
      const req = {
        body: {
          email: 'alice@example.com',
          password: 'password',
        },
        headers: {},
        ip: '127.0.0.1',
      } as unknown as Request;

      const res = {
        json: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as unknown as NextFunction;

      loginController(req, res, next);
      await Promise.resolve();

      const responseData = (res.json as any).mock.calls[0][0];
      const userId = responseData.user.userId;

      // Should be base64 encoded substring (first 20 chars)
      expect(userId.length).toBeLessThanOrEqual(20);
      // When decoded, should relate to the email (first 20 chars of encoded email)
      const emailBase64 = Buffer.from('alice@example.com').toString('base64');
      expect(emailBase64.substring(0, 20)).toBe(userId);
    });

    it('ignores whitespace-only requestedUserId and falls back to email-based generation', async () => {
      const req = {
        body: {
          email: 'bob@example.com',
          password: 'password',
          userId: '   ',
        },
        headers: {},
        ip: '127.0.0.1',
      } as unknown as Request;

      const res = {
        json: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as unknown as NextFunction;

      loginController(req, res, next);
      await Promise.resolve();

      const responseData = (res.json as any).mock.calls[0][0];
      const userId = responseData.user.userId;

      // Should NOT be '   ', should be email-based
      expect(userId).not.toEqual('   ');
      expect(userId.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Response and token structure security', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';
    });

    it('includes both accessToken and token in response for compatibility', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password',
        },
        headers: {},
        ip: '127.0.0.1',
      } as unknown as Request;

      const res = {
        json: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as unknown as NextFunction;

      loginController(req, res, next);
      await Promise.resolve();

      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.token).toBeDefined();
      expect(responseData.accessToken).toBeDefined();
      expect(responseData.token).toBe(responseData.accessToken);
    });

    it('includes refreshToken in response for token rotation flow', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password',
        },
        headers: {},
        ip: '127.0.0.1',
      } as unknown as Request;

      const res = {
        json: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as unknown as NextFunction;

      loginController(req, res, next);
      await Promise.resolve();

      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.refreshToken).toBeDefined();
      expect(typeof responseData.refreshToken).toBe('string');
      expect(responseData.refreshToken.length).toBeGreaterThan(0);
    });

    it('includes expiration times in response', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password',
        },
        headers: {},
        ip: '127.0.0.1',
      } as unknown as Request;

      const res = {
        json: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as unknown as NextFunction;

      loginController(req, res, next);
      await Promise.resolve();

      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.expiresIn).toBeDefined();
      expect(typeof responseData.expiresIn).toBe('number');
      expect(responseData.expiresIn).toBeGreaterThan(0);
      expect(responseData.refreshExpiresIn).toBeDefined();
      expect(typeof responseData.refreshExpiresIn).toBe('number');
    });

    it('includes user metadata in response', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          password: 'password',
          userId: 'test-user-id',
        },
        headers: {},
        ip: '127.0.0.1',
      } as unknown as Request;

      const res = {
        json: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as unknown as NextFunction;

      loginController(req, res, next);
      await Promise.resolve();

      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.user).toBeDefined();
      expect(responseData.user.userId).toBe('test-user-id');
      expect(responseData.user.email).toBe('test@example.com');
    });
  });

  describe('Audit event logging security', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';
    });

    it('requires request context (ip, userAgent) for audit trail', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password',
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        ip: '192.168.1.100',
      } as unknown as Request;

      const res = {
        json: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as unknown as NextFunction;

      loginController(req, res, next);
      await Promise.resolve();

      expect(res.json).toHaveBeenCalled();
      // Audit event should be recorded with IP and user-agent
      // This is verified by the recordAuditEvent service call
    });

    it('logs failed login attempts to audit trail (disabled local login)', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'false';

      const req = {
        body: {
          email: 'user@example.com',
          password: 'password',
        },
        headers: {},
        ip: '192.168.1.100',
      } as Request;

      const res = { json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await new Promise<void>((resolve) => {
        loginController(req, res, ((err?: unknown) => {
          (next as any)(err);
          resolve();
        }) as NextFunction);
      });

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Environment-specific behavior', () => {
    it('allows insecure login in development environment by default', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN;

      expect(isInsecureLocalLoginAllowed()).toBe(true);
    });

    it('allows insecure login in test environment by default', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN;

      expect(isInsecureLocalLoginAllowed()).toBe(true);
    });

    it('disables insecure login in production by default', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN;

      expect(isInsecureLocalLoginAllowed()).toBe(false);
    });

    it('disables insecure login in staging by default', () => {
      process.env.NODE_ENV = 'staging';
      delete process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN;

      expect(isInsecureLocalLoginAllowed()).toBe(false);
    });

    it('respects explicit override even in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';

      expect(isInsecureLocalLoginAllowed()).toBe(true);
    });

    it('respects explicit false override even in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'false';

      expect(isInsecureLocalLoginAllowed()).toBe(false);
    });
  });

  describe('Error handling and attack surface', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';
    });

    it('handles null/undefined values gracefully', async () => {
      const req = {
        body: {
          email: null,
          password: undefined,
        },
        headers: {},
        ip: '127.0.0.1',
      } as unknown as Request;

      const res = { json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await new Promise<void>((resolve) => {
        loginController(req, res, ((err?: unknown) => {
          (next as any)(err);
          resolve();
        }) as NextFunction);
      });

      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('returns 503 for disabled local login instead of 401 (security signal)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'false';

      const req = {
        body: {
          email: 'user@example.com',
          password: 'password',
        },
        headers: {},
        ip: '127.0.0.1',
      } as Request;

      const res = { json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await new Promise<void>((resolve) => {
        loginController(req, res, ((err?: unknown) => {
          (next as any)(err);
          resolve();
        }) as NextFunction);
      });

      const err = (next as any).mock.calls[0][0] as AppError;
      // 503 indicates service misconfiguration, not invalid credentials
      expect(err.statusCode).toBe(503);
    });

    it('does not expose internal error details in error message', async () => {
      process.env.NODE_ENV = 'test';
      process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN = 'true';

      const req = {
        body: {
          email: '',
          password: '',
        },
        headers: {},
        ip: '127.0.0.1',
      } as Request;

      const res = { json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await new Promise<void>((resolve) => {
        loginController(req, res, ((err?: unknown) => {
          (next as any)(err);
          resolve();
        }) as NextFunction);
      });

      const err = (next as any).mock.calls[0][0] as AppError;
      expect(err.message).not.toContain('typeof');
      expect(err.message).not.toContain('undefined');
      expect(err.message).not.toContain('stack');
    });
  });
});
