import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  BillingHookSchema,
  UsageIncrementSchema,
  UsageResetSchema,
  PlanChangeSchema,
  StripeCheckoutSchema,
  StripePortalSchema,
  UsageUpsertSchema,
} from '../validation/saas.schema';
import logger from '../config/logger';
import { billingService } from '../billing/billingService';
import {
  getBillingHooksForWorkspace,
  getWorkspaceBillingHookCount,
  getWorkspaceMeteringSummary,
  getWorkspaceUsage,
  getWorkspaceUsageEvents,
  recordWorkspaceUsage,
  resetWorkspaceUsage,
  setWorkspaceUsage,
} from '../utils/saasStore';
import {
  applyWorkspaceBillingHook,
  changeWorkspacePlan,
  getWorkspacePlanCatalog,
} from '../services/saas/billingService';
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  findWorkspaceForStripeCustomer,
  getPlanFromStripeEvent,
  parseStripeWebhookEvent,
  rememberStripeCustomer,
  rememberStripeCustomerForWorkspace,
  verifyStripeWebhookSignature,
} from '../services/saas/stripeService';
import { getWorkspaceAsync, isUserInWorkspaceAsync } from '../services/admin/workspaceStore';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import {
  isPostgresStateStoreEnabled,
  queryWorkspaceMeteringSummary,
  queryWorkspaceUsageEvents,
} from '../services/persistence/postgresStateStore';

const router = Router();

function resolveWorkspaceId(req: Request): string | undefined {
  const candidate = req.header('x-workspace-id') || req.body?.workspaceId || req.query.workspaceId;
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
}

async function requireAuthorizedWorkspace(req: Request): Promise<string> {
  const workspaceId = resolveWorkspaceId(req);

  if (!workspaceId) {
    throw new AppError(400, 'workspaceId is required for SaaS operations');
  }

  if (!req.userId || !await isUserInWorkspaceAsync(req.userId, workspaceId) || !await getWorkspaceAsync(workspaceId)) {
    throw new AppError(403, 'Access denied to workspace');
  }

  return workspaceId;
}

router.post('/stripe/webhook', asyncHandler(async (req: Request, res: Response) => {
  const rawBody = req.rawBody || '';
  const signatureHeader = req.header('stripe-signature');

  if (!verifyStripeWebhookSignature(rawBody, signatureHeader)) {
    throw new AppError(401, 'Invalid Stripe webhook signature');
  }

  const event = parseStripeWebhookEvent(rawBody);
  const customerId = event.data.object.customer;
  const userId = event.data.object.metadata?.userId;
  const workspaceIdFromMetadata = event.data.object.metadata?.workspaceId;
  const providerSubscriptionId = event.data.object.subscription;
  const providerPriceId = event.data.object.items?.data?.[0]?.price?.id;
  const resolvedWorkspace = workspaceIdFromMetadata
    ? undefined
    : customerId
      ? await findWorkspaceForStripeCustomer(customerId)
      : undefined;
  const workspaceId = workspaceIdFromMetadata || resolvedWorkspace?.workspaceId;

  if (workspaceId && customerId) {
    rememberStripeCustomerForWorkspace(workspaceId, customerId);
  } else if (userId && customerId) {
    await rememberStripeCustomer(userId, customerId);
  }

  const nextPlan = getPlanFromStripeEvent(event);
  if (workspaceId && nextPlan) {
    await billingService.syncProviderSubscription({
      workspaceId,
      provider: 'stripe',
      plan: nextPlan,
      actorUserId: userId,
      billingCustomerId: customerId,
      providerSubscriptionId,
      providerPriceId,
      status: event.type === 'customer.subscription.deleted' ? 'canceled' : 'active',
    });
  }

  logger.info({ eventType: event.type, eventId: event.id, userId, workspaceId, appliedPlan: nextPlan }, 'Stripe webhook processed');
  res.json({ received: true });
}));

router.use(authMiddleware);

router.get('/usage', asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  res.json({ scope: 'workspace', workspaceId, usage: getWorkspaceUsage(workspaceId) });
}));

router.put('/usage', validate(UsageUpsertSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as {
    usage: Record<string, { transactions: number; aiQueries: number; bankConnections: number }>;
  };
  const workspaceId = await requireAuthorizedWorkspace(req);

  setWorkspaceUsage(workspaceId, payload.usage);
  res.json({ success: true, scope: 'workspace', workspaceId });
}));

router.post('/usage/increment', validate(UsageIncrementSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as {
    resource: 'transactions' | 'aiQueries' | 'bankConnections';
    amount?: number;
    at?: string;
    metadata?: Record<string, unknown>;
  };
  const workspaceId = await requireAuthorizedWorkspace(req);
  const total = recordWorkspaceUsage(workspaceId, {
    resource: payload.resource,
    amount: payload.amount ?? 1,
    at: payload.at,
    metadata: payload.metadata,
    userId: req.userId,
  });

  res.json({
    success: true,
    scope: 'workspace',
    workspaceId,
    resource: payload.resource,
    total,
  });
}));

router.post('/usage/reset', validate(UsageResetSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as { monthKey?: string };
  const workspaceId = await requireAuthorizedWorkspace(req);
  resetWorkspaceUsage(workspaceId, payload.monthKey);
  res.json({ success: true, scope: 'workspace', workspaceId, monthKey: payload.monthKey || null });
}));

router.get('/plans', asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  res.json({ scope: 'workspace', workspaceId, ...(await getWorkspacePlanCatalog(workspaceId)) });
}));

router.get('/metering', asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  const filters = {
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    resource: typeof req.query.resource === 'string'
      ? req.query.resource as 'transactions' | 'aiQueries' | 'bankConnections'
      : undefined,
  };

  const eventFilters = {
    ...filters,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : 100,
  };

  res.json({
    scope: 'workspace',
    workspaceId,
    filters,
    summary: isPostgresStateStoreEnabled()
      ? await queryWorkspaceMeteringSummary(workspaceId, filters)
      : getWorkspaceMeteringSummary(workspaceId, filters),
    events: isPostgresStateStoreEnabled()
      ? await queryWorkspaceUsageEvents(workspaceId, eventFilters)
      : getWorkspaceUsageEvents(workspaceId, eventFilters),
  });
}));

router.post('/stripe/checkout-session', validate(StripeCheckoutSchema), asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  const userId = req.userId as string;
  const returnUrl = String(req.body.returnUrl);

  const session = await createStripeCheckoutSession({
    userId,
    email: req.userEmail,
    returnUrl,
    workspaceId,
  });

  res.json(session);
}));

router.post('/stripe/portal-session', validate(StripePortalSchema), asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  const userId = req.userId as string;
  const returnUrl = String(req.body.returnUrl);
  const session = await createStripePortalSession({ userId, returnUrl, workspaceId });
  res.json(session);
}));

router.post('/plan', validate(PlanChangeSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as { plan: 'free' | 'pro' };
  const workspaceId = await requireAuthorizedWorkspace(req);

  const result = await changeWorkspacePlan({
    workspaceId,
    actorUserId: req.userId as string,
    targetPlan: payload.plan,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.info(
    { userId: req.userId, workspaceId, previousPlan: result.previousPlan, currentPlan: result.currentPlan },
    'Workspace SaaS plan changed',
  );

  res.json({ scope: 'workspace', ...result });
}));

router.post('/billing-hooks', validate(BillingHookSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as {
    plan: 'free' | 'pro';
    event: 'usage_recorded' | 'limit_reached' | 'upgrade_required' | 'plan_changed';
    resource?: 'transactions' | 'aiQueries' | 'bankConnections';
    amount: number;
    at: string;
    metadata?: Record<string, unknown>;
  };
  const workspaceId = await requireAuthorizedWorkspace(req);

  const result = await applyWorkspaceBillingHook({
    workspaceId,
    userId: req.userId as string,
    plan: payload.plan,
    event: payload.event,
    resource: payload.resource,
    amount: payload.amount,
    at: payload.at,
    metadata: payload.metadata,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.info(
    {
      userId: req.userId,
      workspaceId,
      billingEvents: getWorkspaceBillingHookCount(workspaceId),
      event: payload.event,
      currentPlan: result.currentPlan,
    },
    'Workspace SaaS billing hook received',
  );

  res.json({
    success: true,
    scope: 'workspace',
    workspaceId,
    currentPlan: result.currentPlan,
    changed: result.changed,
    events: getBillingHooksForWorkspace(workspaceId).length,
  });
}));

export default router;
