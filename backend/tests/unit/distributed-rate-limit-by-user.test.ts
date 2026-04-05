import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';

import { createDistributedRateLimitByUser } from '../../src/middleware/distributedRateLimitByUser';

function createResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    set: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response & { headers: Record<string, string> };
}

describe('createDistributedRateLimitByUser', () => {
  it('allows request under limit and sets headers', async () => {
    const redis = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(60),
    };

    const middleware = createDistributedRateLimitByUser({
      redis,
      namespace: 'clinic-test',
      windowMs: 60000,
      max: 2,
      keyGenerator: () => 'k1',
    });

    const req = { ip: '127.0.0.1' } as Request;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as any).headers['RateLimit-Limit']).toBe('2');
    expect((res as any).headers['RateLimit-Remaining']).toBe('1');
    expect((res as any).headers['RateLimit-Reset']).toBeDefined();
    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  it('blocks request over limit with 429', async () => {
    const redis = {
      incr: vi.fn().mockResolvedValue(3),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(45),
    };

    const middleware = createDistributedRateLimitByUser({
      redis,
      namespace: 'clinic-test',
      windowMs: 60000,
      max: 2,
      keyGenerator: () => 'k-over',
    });

    const req = { ip: '127.0.0.1' } as Request;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(429);
    expect((res as any).json).toHaveBeenCalled();
  });

  it('falls back to in-memory limiter when redis fails', async () => {
    const redis = {
      incr: vi.fn().mockRejectedValue(new Error('redis down')),
      expire: vi.fn(),
      ttl: vi.fn(),
    };

    const middleware = createDistributedRateLimitByUser({
      redis,
      namespace: 'clinic-test',
      windowMs: 60000,
      max: 1,
      keyGenerator: () => 'k-fallback',
    });

    const req = { headers: {}, ip: '127.0.0.1' } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as any).status).toHaveBeenCalledWith(429);
  });
});
