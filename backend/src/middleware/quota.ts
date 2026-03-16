import { NextFunction, Request, Response } from 'express';
import { asyncHandler } from './errorHandler';
import logger from '../config/logger';
import {
  PLAN_LIMITS,
  getUserPlan,
  getMonthlyCount,
  incrementMonthlyUsage,
  isWithinLimit,
} from '../utils/saasStore';
import { recordAuditEvent } from '../services/admin/auditLog';

type ResourceKind = 'transactions' | 'aiQueries' | 'bankConnections';

/**
 * quotaMiddleware — enforce per-plan monthly limits before a route handler runs.
 *
 * Usage:
 *   router.post('/interpret', quotaMiddleware('aiQueries'), interpretController);
 *   router.post('/connect',   quotaMiddleware('bankConnections'), connectBankController);
 *
 * On success it also increments the counter so usage is tracked automatically.
 * Pass `trackOnly: true` to increment without blocking (useful for transactions).
 */
export function quotaMiddleware(
  resource: ResourceKind,
  amount = 1,
  options: { trackOnly?: boolean } = {},
) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;

    if (!userId) {
      // Auth middleware should have blocked unauthenticated requests before this.
      // If we get here without a userId, let the auth layer handle it.
      return next();
    }

    const plan = getUserPlan(userId);
    const limit = PLAN_LIMITS[plan][resource];
    const current = getMonthlyCount(userId, resource);
    const remaining = Math.max(0, limit - current);

    // Set informational headers regardless of outcome
    res.setHeader('X-RateLimit-Plan', plan);
    res.setHeader('X-RateLimit-Resource', resource);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining - amount)));
    res.setHeader('X-RateLimit-Reset', getMonthResetEpoch());

    if (!options.trackOnly && !isWithinLimit(userId, resource, amount)) {
      logger.warn(
        { userId, plan, resource, current, limit },
        'Quota exceeded — request blocked',
      );
      recordAuditEvent({ userId, action: 'quota.exceeded', status: 'blocked', resource, metadata: { plan, current, limit } });

      res.status(429).json({
        message: `Monthly ${resource} limit reached for your plan (${plan}). Upgrade to pro for higher limits.`,
        resource,
        plan,
        limit,
        current,
        upgradeUrl: '/api/saas/plans',
      });
      return;
    }

    incrementMonthlyUsage(userId, resource, amount);
    logger.debug({ userId, plan, resource, newTotal: current + amount, limit }, 'Quota incremented');

    next();
  });
}

function getMonthResetEpoch(): string {
  const now = new Date();
  const firstOfNextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0),
  );
  return String(Math.floor(firstOfNextMonth.getTime() / 1000));
}
