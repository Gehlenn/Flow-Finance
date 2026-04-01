import { NextFunction, Request, Response } from 'express';
import { asyncHandler } from './errorHandler';
import logger from '../config/logger';
import {
  PLAN_LIMITS,
  getMonthlyCount,
  getUserPlan,
  getWorkspaceLimits,
  getWorkspaceMonthlyCount,
  getWorkspacePlan,
  incrementMonthlyUsage,
  incrementWorkspaceMonthlyUsage,
  isWithinLimit,
  isWorkspaceWithinLimit,
} from '../utils/saasStore';
import { recordAuditEvent } from '../services/admin/auditLog';
import { getWorkspaceAsync, isUserInWorkspaceAsync } from '../services/admin/workspaceStore';

type ResourceKind = 'transactions' | 'aiQueries' | 'bankConnections';

export function quotaMiddleware(
  resource: ResourceKind,
  amount = 1,
  options: { trackOnly?: boolean } = {},
) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const workspaceId = await resolveAuthorizedWorkspaceId(req);

    if (!userId && !workspaceId) {
      return next();
    }

    const scope = workspaceId ? 'workspace' : 'user';
    const scopeId = workspaceId || userId!;
    const plan = workspaceId ? getWorkspacePlan(workspaceId) : getUserPlan(userId!);
    const limit = workspaceId ? getWorkspaceLimits(workspaceId)[resource] : PLAN_LIMITS[plan][resource];
    const current = workspaceId
      ? getWorkspaceMonthlyCount(workspaceId, resource)
      : getMonthlyCount(userId!, resource);
    const remaining = Math.max(0, limit - current);

    res.setHeader('X-RateLimit-Plan', plan);
    res.setHeader('X-RateLimit-Scope', scope);
    res.setHeader('X-RateLimit-Resource', resource);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining - amount)));
    res.setHeader('X-RateLimit-Reset', getMonthResetEpoch());

    const isAllowed = workspaceId
      ? isWorkspaceWithinLimit(workspaceId, resource, amount)
      : isWithinLimit(userId!, resource, amount);

    if (!options.trackOnly && !isAllowed) {
      logger.warn(
        { userId, workspaceId, plan, resource, current, limit, scope },
        'Quota exceeded - request blocked',
      );
      recordAuditEvent({
        userId,
        action: 'quota.exceeded',
        status: 'blocked',
        resource: scopeId,
        metadata: { plan, current, limit, quotaResource: resource, scope },
      });

      res.status(429).json({
        message: `Monthly ${resource} limit reached for this ${scope} plan (${plan}). Upgrade to pro for higher limits.`,
        resource,
        plan,
        scope,
        scopeId,
        limit,
        current,
        upgradeUrl: '/api/saas/plans',
      });
      return;
    }

    if (workspaceId) {
      incrementWorkspaceMonthlyUsage(workspaceId, resource, amount);
    } else {
      incrementMonthlyUsage(userId!, resource, amount);
    }

    logger.debug({ userId, workspaceId, plan, resource, newTotal: current + amount, limit, scope }, 'Quota incremented');

    next();
  });
}

async function resolveAuthorizedWorkspaceId(req: Request): Promise<string | undefined> {
  const headerWorkspaceId = typeof req.header === 'function'
    ? req.header('x-workspace-id')
    : undefined;
  const candidate =
    (req as Request & { workspaceId?: string }).workspaceId ||
    headerWorkspaceId ||
    req.params.workspaceId ||
    req.query.workspaceId ||
    req.body?.workspaceId;

  if (!candidate || typeof candidate !== 'string' || !req.userId) {
    return undefined;
  }

  if (!await getWorkspaceAsync(candidate) || !await isUserInWorkspaceAsync(req.userId, candidate)) {
    return undefined;
  }

  return candidate;
}

function getMonthResetEpoch(): string {
  const now = new Date();
  const firstOfNextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0),
  );
  return String(Math.floor(firstOfNextMonth.getTime() / 1000));
}
