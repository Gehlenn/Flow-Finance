import { NextFunction, Request, Response } from 'express';
import { asyncHandler } from './errorHandler';
import logger from '../config/logger';
import {
  PLAN_LIMITS,
  ResourceKind,
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
import {
  isFirestoreAiUsageAuthorityEnabled,
  reserveWorkspaceUsage,
  WorkspaceUsageAuthorityUnavailableError,
  WorkspaceUsageIdempotencyConflictError,
} from '../services/usage/workspaceUsageAuthority';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function quotaMiddleware(
  resource: ResourceKind,
  amount = 1,
) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const workspaceId = await resolveAuthorizedWorkspaceId(req);

    if (!userId && !workspaceId) {
      return next();
    }

    if (workspaceId && userId) {
      if (resource === 'aiQueries' && isFirestoreAiUsageAuthorityEnabled()) {
        await enforceWorkspaceQuota({ req, res, next, workspaceId, userId, resource, amount });
      } else {
        await enforceLegacyQuota({ req, res, next, workspaceId, userId, resource, amount });
      }
      return;
    }

    await enforceUserQuota({ req, res, next, userId: userId!, resource, amount });
  });
}

type QuotaRequest = {
  req: Request;
  res: Response;
  next: NextFunction;
  userId: string;
  resource: ResourceKind;
  amount: number;
};

async function enforceWorkspaceQuota(input: QuotaRequest & { workspaceId: string }): Promise<void> {
  const idempotencyKey = getQuotaIdempotencyKey(input.req, input.res);
  if (!idempotencyKey) {
    return;
  }

  try {
    const reservation = await reserveWorkspaceUsage({
      workspaceId: input.workspaceId,
      userId: input.userId,
      resource: input.resource,
      amount: input.amount,
      idempotencyKey,
    });

    if (reservation) {
      setQuotaHeaders(input.res, {
        plan: reservation.plan,
        scope: 'workspace',
        resource: input.resource,
        limit: reservation.limit,
        remaining: reservation.remaining,
      });

      if (reservation.outcome === 'limit_exceeded') {
        if (!reservation.idempotent) {
          logQuotaExceeded({
            userId: input.userId,
            workspaceId: input.workspaceId,
            plan: reservation.plan,
            resource: input.resource,
            current: reservation.current,
            limit: reservation.limit,
            scope: 'workspace',
          });
        }
        input.res.status(429).json(buildQuotaExceededResponse({
          resource: input.resource,
          plan: reservation.plan,
          scope: 'workspace',
          scopeId: input.workspaceId,
          limit: reservation.limit,
          current: reservation.current,
        }));
        return;
      }

      if (reservation.idempotent) {
        input.res.status(409).json({
          error: 'idempotency_replay',
          message: 'This Idempotency-Key has already been used for an existing quota reservation.',
        });
        return;
      }

      logger.debug(
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          plan: reservation.plan,
          resource: input.resource,
          newTotal: reservation.current,
          limit: reservation.limit,
          scope: 'workspace',
        },
        'Workspace quota reservation accepted',
      );
      input.next();
      return;
    }
  } catch (error) {
    if (error instanceof WorkspaceUsageIdempotencyConflictError) {
      input.res.status(409).json({
        error: 'idempotency_conflict',
        message: 'Idempotency-Key conflicts with a prior quota reservation.',
      });
      return;
    }

    if (error instanceof WorkspaceUsageAuthorityUnavailableError) {
      if (requiresWorkspaceUsageAuthority()) {
        respondQuotaAuthorityUnavailable(input.res);
      } else {
        await enforceLegacyQuota(input);
      }
      return;
    }

    throw error;
  }

  if (requiresWorkspaceUsageAuthority()) {
    respondQuotaAuthorityUnavailable(input.res);
    return;
  }

  await enforceLegacyQuota(input);
}

async function enforceUserQuota(input: QuotaRequest): Promise<void> {
  await enforceLegacyQuota(input);
}

async function enforceLegacyQuota(input: QuotaRequest & { workspaceId?: string }): Promise<void> {
  const { req, res, next, userId, workspaceId, resource, amount } = input;

  const scope = workspaceId ? 'workspace' : 'user';
  const scopeId = workspaceId || userId;
  const plan = workspaceId ? getWorkspacePlan(workspaceId) : getUserPlan(userId);
  const limit = workspaceId ? getWorkspaceLimits(workspaceId)[resource] : PLAN_LIMITS[plan][resource];
  const current = workspaceId
    ? getWorkspaceMonthlyCount(workspaceId, resource)
    : getMonthlyCount(userId, resource);
  const isAllowed = workspaceId
    ? isWorkspaceWithinLimit(workspaceId, resource, amount)
    : isWithinLimit(userId, resource, amount);

  setQuotaHeaders(res, {
    plan,
    scope,
    resource,
    limit,
    remaining: Math.max(0, current > limit ? 0 : limit - current - amount),
  });

  if (!isAllowed) {
    logQuotaExceeded({ userId, workspaceId, plan, resource, current, limit, scope });
    res.status(429).json(buildQuotaExceededResponse({ resource, plan, scope, scopeId, limit, current }));
    return;
  }

  try {
    if (workspaceId) {
      await incrementWorkspaceMonthlyUsage(workspaceId, resource, amount);
    } else {
      await incrementMonthlyUsage(userId, resource, amount);
    }
  } catch (error) {
    setQuotaHeaders(res, {
      plan,
      scope,
      resource,
      limit,
      remaining: Math.max(0, limit - current),
    });
    logger.error(
      {
        requestId: req.requestId,
        routeScope: req.routeScope,
        userId,
        workspaceId,
        plan,
        resource,
        amount,
        scope,
        current,
        limit,
        errorType: error instanceof Error ? error.name : typeof error,
        fallback: 'quota-persistence-failed',
      },
      'Legacy quota persistence failed; request blocked',
    );
    respondQuotaPersistenceUnavailable(req, res);
    return;
  }

  logger.debug({ userId, workspaceId, plan, resource, newTotal: current + amount, limit, scope }, 'Quota incremented');
  next();
}

function getQuotaIdempotencyKey(req: Request, res: Response): string | undefined {
  const headerValue = req.header('Idempotency-Key');
  if (headerValue !== undefined) {
    if (!IDEMPOTENCY_KEY_PATTERN.test(headerValue)) {
      res.status(400).json({
        error: 'invalid_idempotency_key',
        message: 'Idempotency-Key must use 1-128 letters, numbers, dots, underscores, colons, or hyphens.',
      });
      return undefined;
    }
    return headerValue;
  }

  if (requiresWorkspaceUsageAuthority()) {
    res.status(400).json({
      error: 'missing_idempotency_key',
      message: 'Idempotency-Key is required for production workspace quota reservations.',
    });
    return undefined;
  }

  const requestId = req.requestId;
  if (requestId && IDEMPOTENCY_KEY_PATTERN.test(requestId)) {
    return requestId;
  }

  res.status(400).json({
    error: 'missing_idempotency_key',
    message: 'Idempotency-Key is required when request context is unavailable.',
  });
  return undefined;
}

function setQuotaHeaders(
  res: Response,
  input: { plan: string; scope: 'workspace' | 'user'; resource: ResourceKind; limit: number; remaining: number },
): void {
  res.setHeader('X-RateLimit-Plan', input.plan);
  res.setHeader('X-RateLimit-Scope', input.scope);
  res.setHeader('X-RateLimit-Resource', input.resource);
  res.setHeader('X-RateLimit-Limit', String(input.limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, input.remaining)));
  res.setHeader('X-RateLimit-Reset', getMonthResetEpoch());
}

function buildQuotaExceededResponse(input: {
  resource: ResourceKind;
  plan: string;
  scope: 'workspace' | 'user';
  scopeId: string;
  limit: number;
  current: number;
}): Record<string, string | number> {
  return {
    message: `Monthly ${input.resource} limit reached for this ${input.scope} plan (${input.plan}). Upgrade to pro for higher limits.`,
    resource: input.resource,
    plan: input.plan,
    scope: input.scope,
    scopeId: input.scopeId,
    limit: input.limit,
    current: input.current,
    upgradeUrl: '/api/saas/plans',
  };
}

function logQuotaExceeded(input: {
  userId: string;
  workspaceId?: string;
  plan: string;
  resource: ResourceKind;
  current: number;
  limit: number;
  scope: 'workspace' | 'user';
}): void {
  logger.warn(input, 'Quota exceeded - request blocked');
  recordAuditEvent({
    userId: input.userId,
    action: 'quota.exceeded',
    status: 'blocked',
    resource: input.workspaceId || input.userId,
    metadata: {
      plan: input.plan,
      current: input.current,
      limit: input.limit,
      quotaResource: input.resource,
      scope: input.scope,
    },
  });
}

function requiresWorkspaceUsageAuthority(): boolean {
  return isFirestoreAiUsageAuthorityEnabled()
    && (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1');
}

function respondQuotaAuthorityUnavailable(res: Response): void {
  res.status(503).json({
    error: 'quota_authority_unavailable',
    message: 'Workspace quota authority is unavailable.',
  });
}

function respondQuotaPersistenceUnavailable(req: Request, res: Response): void {
  res.status(503).json({
    error: 'quota_persistence_unavailable',
    message: 'Quota usage could not be recorded. Please try again later.',
    ...(req.requestId ? { requestId: req.requestId } : {}),
    ...(req.routeScope ? { routeScope: req.routeScope } : {}),
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
