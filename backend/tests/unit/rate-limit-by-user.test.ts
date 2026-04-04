import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import {
  createRateLimitByUser,
  resetRateLimitStore,
  getRateLimitStoreSnapshot,
} from '../../src/middleware/rateLimitByUser';

describe('Rate Limit by User', () => {
  function createResponse() {
    return {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
  }

  beforeEach(() => {
    resetRateLimitStore();
  });

  it('allows requests under limit', async () => {
    const middleware = createRateLimitByUser({ windowMs: 60000, max: 5 });
    const req = { headers: {} } as Request & { userId?: string };
    const res = createResponse();
    const next = vi.fn();

    for (let i = 0; i < 5; i++) {
      const nextCalled = { called: false };
      await middleware(req, res as Response, () => {
        nextCalled.called = true;
        next();
      });
      expect(nextCalled.called).toBe(true);
    }

    expect((res as unknown as { status: ReturnType<typeof vi.fn> }).status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(5);
  });

  it('blocks requests over limit', async () => {
    const middleware = createRateLimitByUser({ windowMs: 60000, max: 2 });
    const req = { headers: {} } as Request & { userId?: string };
    const res = createResponse();
    const next = vi.fn();

    // Allow 2 requests
    for (let i = 0; i < 2; i++) {
      await middleware(req, res as Response, next);
    }

    // 3rd request should be blocked
    await middleware(req, res as Response, next);
    expect((res as unknown as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(429);
    expect((res as unknown as { json: ReturnType<typeof vi.fn> }).json).toHaveBeenCalled();
  });

  it('uses userId + workspaceId as key when authenticated', async () => {
    const middleware = createRateLimitByUser({ windowMs: 60000, max: 2 });
    const req1 = {
      headers: {},
      userId: 'user1',
      workspaceId: 'ws1',
    } as unknown as Request;
    const req2 = {
      headers: {},
      userId: 'user2',
      workspaceId: 'ws1',
    } as unknown as Request;

    const res = createResponse();
    const next = vi.fn();

    // User1 - allow 2
    for (let i = 0; i < 2; i++) {
      await middleware(req1, res as Response, next);
    }

    // User2 - should still allow 2 (different key)
    for (let i = 0; i < 2; i++) {
      await middleware(req2, res as Response, next);
    }

    const snapshot = getRateLimitStoreSnapshot();
    expect(Object.keys(snapshot).length).toBe(2); // Two separate buckets
    expect(next).toHaveBeenCalledTimes(4);
  });

  it('skips rate limiting when skip returns true', async () => {
    const middleware = createRateLimitByUser({
      windowMs: 60000,
      max: 1,
      skip: (req) => req.path === '/health',
    });

    const req = { headers: {}, path: '/health' } as Request;
    const res = createResponse();
    const next = vi.fn();

    // Both should pass even though max is 1
    await middleware(req, res as Response, next);
    await middleware(req, res as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('allows custom key generator', async () => {
    const middleware = createRateLimitByUser({
      windowMs: 60000,
      max: 1,
      keyGenerator: (req) => `custom::${(req as any).customId}`,
    });

    const req1 = { headers: {}, customId: '123' } as unknown as Request;
    const req2 = { headers: {}, customId: '456' } as unknown as Request;

    const res = createResponse();
    const next = vi.fn();

    // Different custom IDs should have separate limits
    await middleware(req1, res as Response, next);
    await middleware(req2, res as Response, next);

    const snapshot = getRateLimitStoreSnapshot();
    expect(Object.keys(snapshot).length).toBe(2);
  });

  it('calls onLimitReached callback when limit is exceeded', async () => {
    let callbackCalled = false;
    let callbackKey = '';

    const middleware = createRateLimitByUser({
      windowMs: 60000,
      max: 1,
      onLimitReached: (key) => {
        callbackCalled = true;
        callbackKey = key;
      },
    });

    const req = { headers: {} } as Request;
    const res = createResponse();
    const next = vi.fn();

    // First request - allowed
    await middleware(req, res as Response, next);

    // Reset callback state
    callbackCalled = false;
    callbackKey = '';

    // Second request - blocked
    await middleware(req, res as Response, vi.fn());

    expect(callbackCalled).toBe(true);
    expect(callbackKey).toContain('ip::');
  });

  it('falls back to IP when userId not available', async () => {
    const middleware = createRateLimitByUser({ windowMs: 60000, max: 5 });
    const req = { headers: { 'x-forwarded-for': '192.168.1.1' } } as Request;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res as Response, next);

    const snapshot = getRateLimitStoreSnapshot();
    const keys = Object.keys(snapshot);
    expect(keys[0]).toContain('ip::');
  });

  it('respects RateLimit headers in response', async () => {
    const headers: Record<string, string> = {};
    const middleware = createRateLimitByUser({ windowMs: 60000, max: 5 });
    const req = { headers: {} } as Request;
    const res = {
      set: (header: string, value: string) => {
        headers[header] = value;
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await middleware(req, res as Response, next);

    expect(headers['RateLimit-Limit']).toBe('5');
    expect(headers['RateLimit-Remaining']).toBe('4');
    expect(headers['RateLimit-Reset']).toBeDefined();
  });
});
