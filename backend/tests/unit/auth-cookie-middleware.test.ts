import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { authMiddleware, generateAccessToken } from '../../src/middleware/auth';
import { AUTH_COOKIE_NAMES } from '../../src/services/auth/authCookies';

describe('authMiddleware cookie support', () => {
  it('accepts access token from HttpOnly cookie fallback', () => {
    const token = generateAccessToken('user-cookie', 'cookie@test.dev');
    const req = {
      headers: {
        cookie: `${AUTH_COOKIE_NAMES.access}=${encodeURIComponent(token)}`,
      },
    } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { userId?: string }).userId).toBe('user-cookie');
    expect((res as any).status).not.toHaveBeenCalled();
  });
});
