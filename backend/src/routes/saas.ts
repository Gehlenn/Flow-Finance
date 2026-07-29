import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authz } from '../middleware/authz';
import { parseSafeLimit } from '../utils/jsonHelpers';
import { validate } from '../middleware/validate';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import {
  BillingHookSchema,
  PlanChangeSchema,
  StripeCheckoutSchema,
  StripePortalSchema,
  type BillingHookRequest,
  type PlanChangeRequest,
  type StripeCheckoutRequest,
  type StripePortalRequest,
} from '../validation/saas.schema';
import logger from '../config/logger';
import { billingService } from '../billing/billingService';
import {
  getBillingHooksForWorkspace,
  enrichWorkspaceUsageEventsWithAICost,
  getWorkspaceAICostSummaryFromEvents,
  getWorkspaceBillingHookCount,
  getWorkspaceMeteringSummary,
  getWorkspaceUsage,
  getWorkspaceUsageEvents,
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
  claimStripeWebhookEvent,
} from '../services/saas/stripeService';
import { getWorkspaceAsync, isUserInWorkspaceAsync } from '../services/admin/workspaceStore';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import {
  isPostgresStateStoreEnabled,
  queryWorkspaceMeteringSummary,
  queryWorkspaceUsageEvents,
} from '../services/persistence/postgresStateStore';
import { isResourceKind } from '../../shared/saasCatalog';
import {
  getAuthoritativeWorkspaceUsage,
  isFirestoreAiUsageAuthorityEnabled,
} from '../services/usage/workspaceUsageAuthority';

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
  if (!await claimStripeWebhookEvent(event.id)) {
    res.json({ received: true, duplicate: true });
    return;
  }

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
    await rememberStripeCustomerForWorkspace(workspaceId, customerId);
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
router.use(workspaceContextMiddleware);

router.get('/usage', authz('billing:read'), asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  const legacyUsage = getWorkspaceUsage(workspaceId);

  if (!isFirestoreAiUsageAuthorityEnabled()) {
    res.json({
      scope: 'workspace',
      workspaceId,
      usage: legacyUsage,
    });
    return;
  }

  try {
    const authoritative = await getAuthoritativeWorkspaceUsage(workspaceId);
    if (authoritative) {
      const legacyCurrentMonth = legacyUsage[authoritative.monthKey];
      res.json({
        scope: 'workspace',
        workspaceId,
        currentMonthKey: authoritative.monthKey,
        plan: authoritative.plan,
        usage: {
          ...legacyUsage,
          [authoritative.monthKey]: {
            transactions: legacyCurrentMonth?.transactions ?? 0,
            aiQueries: authoritative.usage.aiQueries,
            bankConnections: legacyCurrentMonth?.bankConnections ?? 0,
          },
        },
      });
      return;
    }
  } catch (error) {
    logger.error({
      error,
      workspaceId,
      fallback: 'workspace-usage-authority-read-failed',
    }, 'Failed to read authoritative workspace usage');
    throw new AppError(503, 'Workspace usage authority is unavailable');
  }

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    throw new AppError(503, 'Workspace usage authority is unavailable');
  }

  res.json({
    scope: 'workspace',
    workspaceId,
    usage: legacyUsage,
  });
}));

router.get('/billing-hooks', authz('billing:read'), asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  const workspace = await getWorkspaceAsync(workspaceId);
  if (!workspace) {
    throw new AppError(404, 'Workspace not found');
  }

  const hooks = getBillingHooksForWorkspace(workspaceId).map((hook, index) => ({
    ...hook,
    id: `${workspaceId}_${hook.at}_${index}`,
    tenantId: workspace.tenantId,
    workspaceId,
    createdAt: hook.at,
  }));

  res.json({ scope: 'workspace', workspaceId, hooks });
}));

router.get('/plans', authz('billing:read'), asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  res.json({ scope: 'workspace', workspaceId, ...(await getWorkspacePlanCatalog(workspaceId)) });
}));

router.get('/metering', authz('billing:read'), asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = await requireAuthorizedWorkspace(req);
  const filters = {
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    resource: isResourceKind(req.query.resource) ? req.query.resource : undefined,
  };

  const eventFilters = {
    ...filters,
    limit: parseSafeLimit(req.query.limit, 100),
  };

  const summaryEvents = isPostgresStateStoreEnabled()
    ? await queryWorkspaceUsageEvents(workspaceId, filters)
    : getWorkspaceUsageEvents(workspaceId, filters);

  const sourceEvents = isPostgresStateStoreEnabled()
    ? await queryWorkspaceUsageEvents(workspaceId, eventFilters)
    : getWorkspaceUsageEvents(workspaceId, eventFilters);

  res.json({
    scope: 'workspace',
    workspaceId,
    filters,
    summary: {
      ...(isPostgresStateStoreEnabled()
        ? await queryWorkspaceMeteringSummary(workspaceId, filters)
        : getWorkspaceMeteringSummary(workspaceId, filters)),
      aiCost: getWorkspaceAICostSummaryFromEvents(workspaceId, summaryEvents),
    },
    events: enrichWorkspaceUsageEventsWithAICost(workspaceId, sourceEvents),
  });
}));

router.post('/stripe/checkout-session', authz('billing:manage'), validate(StripeCheckoutSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as StripeCheckoutRequest;
  const workspaceId = await requireAuthorizedWorkspace(req);
  const userId = req.userId as string;
  const returnUrl = payload.returnUrl;

  const session = await createStripeCheckoutSession({
    userId,
    email: req.userEmail,
    returnUrl,
    workspaceId,
  });

  res.json(session);
}));

router.post('/stripe/portal-session', authz('billing:manage'), validate(StripePortalSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as StripePortalRequest;
  const workspaceId = await requireAuthorizedWorkspace(req);
  const userId = req.userId as string;
  const returnUrl = payload.returnUrl;
  const session = await createStripePortalSession({ userId, returnUrl, workspaceId });
  res.json(session);
}));

router.post('/plan', authz('billing:manage'), validate(PlanChangeSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as PlanChangeRequest;
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

router.post('/billing-hooks', authz('billing:manage'), validate(BillingHookSchema), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as BillingHookRequest;
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
