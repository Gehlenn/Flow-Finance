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
});
