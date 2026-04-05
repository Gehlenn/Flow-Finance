import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Per-user/workspace rate limiter with keyed store.
 * Composable with user/workspace context from auth middleware.
 * Falls back to IP if not authenticated.
 */

interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

type RateLimitStore = Map<string, RateLimitBucket>;

const store: RateLimitStore = new Map();

export interface RateLimitByUserConfig {
  windowMs: number; // milliseconds
  max: number; // requests per window
  keyGenerator?: (req: Request) => string | Promise<string>;
  skip?: (req: Request) => boolean;
  onLimitReached?: (key: string, req: Request) => void;
}

function buildDefaultKey(req: Request): string {
  // Prefer userId + workspaceId if authenticated
  const userId = (req as Request & { userId?: string }).userId;
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;

  if (userId && workspaceId) {
    return `${workspaceId}::${userId}`;
  }

  if (userId) {
    return `user::${userId}`;
  }

  // Fallback to IP
  const ip = req.headers['x-forwarded-for'] as string
    || req.socket?.remoteAddress
    || req.ip
    || 'unknown';
  return `ip::${ip}`;
}

function checkLimit(
  key: string,
  config: RateLimitByUserConfig,
): RateLimitCheckResult {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    store.set(key, bucket);
  }

  if (bucket.count < config.max) {
    bucket.count++;
    return {
      allowed: true,
      remaining: config.max - bucket.count,
      resetTime: bucket.resetAt,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetTime: bucket.resetAt,
  };
}

/**
 * Middleware factory for per-user rate limiting.
 * Respects user context, workspace context, falls back to IP.
 * Suitable for critical endpoints like auth, billing, AI.
 */
export function createRateLimitByUser(config: RateLimitByUserConfig) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (config.skip?.(req)) {
      return next();
    }

    let key: string;
    try {
      key = config.keyGenerator
        ? await config.keyGenerator(req)
        : buildDefaultKey(req);
    } catch (error) {
      logger.warn({ error }, 'Failed to generate rate limit key, falling back to IP');
      key = buildDefaultKey(req);
    }

    const result = checkLimit(key, config);

    res.set('RateLimit-Limit', String(config.max));
    res.set('RateLimit-Remaining', String(Math.max(0, result.remaining)));
    res.set('RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));

    if (!result.allowed) {
      config.onLimitReached?.(key, req);
      logger.warn(
        { key, windowMs: config.windowMs, max: config.max },
        'Rate limit exceeded',
      );

      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Reset store for testing.
 */
export function resetRateLimitStore(): void {
  store.clear();
}

/**
 * Get current store state (for testing/monitoring).
 */
export function getRateLimitStoreSnapshot(): Record<string, RateLimitBucket> {
  return Object.fromEntries(store);
}

/**
 * Cleanup expired buckets periodically.
 */
export function startRateLimitCleanup(intervalMs = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, bucket] of store.entries()) {
      if (now > bucket.resetAt) {
        store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cleaned expired rate limit buckets');
    }
  }, intervalMs);
}
