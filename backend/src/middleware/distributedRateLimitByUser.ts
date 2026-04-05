import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import { createRateLimitByUser, RateLimitByUserConfig } from './rateLimitByUser';

interface RedisCounterLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number | boolean>;
  ttl(key: string): Promise<number>;
}

export interface DistributedRateLimitByUserConfig extends RateLimitByUserConfig {
  redis: RedisCounterLike;
  namespace: string;
}

function getWindowSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

export function createDistributedRateLimitByUser(config: DistributedRateLimitByUserConfig) {
  const {
    redis,
    namespace,
    windowMs,
    max,
    keyGenerator,
    skip,
    onLimitReached,
  } = config;

  // Resiliency fallback in case Redis is unavailable.
  const fallbackLimiter = createRateLimitByUser({
    windowMs,
    max,
    keyGenerator,
    skip,
    onLimitReached,
  });

  const windowSeconds = getWindowSeconds(windowMs);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (skip?.(req)) {
      return next();
    }

    const limiterKey = keyGenerator
      ? await keyGenerator(req)
      : `${(req as Request & { workspaceId?: string }).workspaceId || 'global'}::${req.ip || 'unknown'}`;

    const redisKey = `ratelimit:${namespace}:${limiterKey}`;

    try {
      const currentCount = await redis.incr(redisKey);

      if (currentCount === 1) {
        await redis.expire(redisKey, windowSeconds);
      }

      const ttlSeconds = await redis.ttl(redisKey);
      const resetSeconds = ttlSeconds > 0 ? ttlSeconds : windowSeconds;

      const remaining = Math.max(0, max - currentCount);
      const resetUnixSeconds = Math.ceil(Date.now() / 1000) + resetSeconds;

      res.set('RateLimit-Limit', String(max));
      res.set('RateLimit-Remaining', String(remaining));
      res.set('RateLimit-Reset', String(resetUnixSeconds));

      if (currentCount > max) {
        onLimitReached?.(limiterKey, req);
        logger.warn(
          { namespace, limiterKey, currentCount, max, resetSeconds },
          'Distributed rate limit exceeded',
        );

        res.status(429).json({
          error: 'Too many requests',
          retryAfter: resetSeconds,
        });
        return;
      }

      next();
    } catch (error) {
      logger.warn(
        { error, namespace, limiterKey },
        'Distributed rate limiter unavailable, falling back to in-memory limiter',
      );
      return fallbackLimiter(req, res, next);
    }
  };
}
