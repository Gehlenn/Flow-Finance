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
  type UsageSnapshot,
  type WorkspaceUsageEvent,
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
  getAuthoritativeWorkspaceUsageEvents,
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

type MeteringFilters = {
  from?: string;
  to?: string;
  resource?: 'transactions' | 'aiQueries' | 'bankConnections';
};

type MeteringSummary = {
  totals: UsageSnapshot;
  months: Record<string, UsageSnapshot>;
};

function parseMeteringTimestamp(value: unknown, field: 'from' | 'to'): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new AppError(400, `${field} must be a valid ISO 8601 timestamp with a timezone`);
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new AppError(400, `${field} must be a valid ISO 8601 timestamp with a timezone`);
  }
  return timestamp.toISOString();
}

function eventMonthKey(at: string): string {
  const date = new Date(at);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function matchesEventFilters(event: WorkspaceUsageEvent, filters: MeteringFilters): boolean {
  if (filters.resource && event.resource !== filters.resource) {
    return false;
  }
  if (filters.from && new Date(event.at).getTime() < new Date(filters.from).getTime()) {
    return false;
  }
  if (filters.to && new Date(event.at).getTime() > new Date(filters.to).getTime()) {
    return false;
  }
  return true;
}

function matchesSummaryMonth(monthKey: string, filters: MeteringFilters): boolean {
  const monthDate = new Date(`${monthKey}-01T00:00:00.000Z`).getTime();
  if (filters.from && monthDate < new Date(filters.from).getTime()) {
    return false;
  }
  if (filters.to && monthDate > new Date(filters.to).getTime()) {
    return false;
  }
  return true;
}

function meteringTotals(months: Record<string, UsageSnapshot>, resource?: MeteringFilters['resource']): UsageSnapshot {
  return Object.values(months).reduce<UsageSnapshot>((totals, usage) => ({
    transactions: totals.transactions + (resource === 'transactions' || !resource ? usage.transactions : 0),
    aiQueries: totals.aiQueries + (resource === 'aiQueries' || !resource ? usage.aiQueries : 0),
    bankConnections: totals.bankConnections + (resource === 'bankConnections' || !resource ? usage.bankConnections : 0),
  }), { transactions: 0, aiQueries: 0, bankConnections: 0 });
}

function mergeCurrentMonthAuthoritativeAiEvents(input: {
  legacyEvents: WorkspaceUsageEvent[];
  authoritativeEvents: WorkspaceUsageEvent[];
  monthKey: string;
  filters: MeteringFilters;
  limit?: number;
}): WorkspaceUsageEvent[] {
  const legacyWithoutCurrentAuthoritativeAi = input.legacyEvents.filter((event) => !(
    event.resource === 'aiQueries' && eventMonthKey(event.at) === input.monthKey
  ));
  const authorityEvents = input.authoritativeEvents.filter((event) => matchesEventFilters(event, input.filters));
  const merged = [...legacyWithoutCurrentAuthoritativeAi, ...authorityEvents]
    .sort((left, right) => right.at.localeCompare(left.at) || right.id.localeCompare(left.id));

  return input.limit ? merged.slice(0, input.limit) : merged;
}

function replaceCurrentMonthAuthoritativeAiSummary(input: {
  summary: MeteringSummary;
  monthKey: string;
  aiQueries: number;
  filters: MeteringFilters;
}): MeteringSummary {
  const months = Object.fromEntries(Object.entries(input.summary.months).map(([monthKey, usage]) => [
    monthKey,
    { ...usage },
  ])) as Record<string, UsageSnapshot>;

  if (matchesSummaryMonth(input.monthKey, input.filters)) {
    const legacyMonth = months[input.monthKey] ?? { transactions: 0, aiQueries: 0, bankConnections: 0 };
    months[input.monthKey] = { ...legacyMonth, aiQueries: input.aiQueries };
  }

  return {
    months,
    totals: meteringTotals(months, input.filters.resource),
  };
}

function isProductionAuthorityEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
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
    from: parseMeteringTimestamp(req.query.from, 'from'),
    to: parseMeteringTimestamp(req.query.to, 'to'),
    resource: isResourceKind(req.query.resource) ? req.query.resource : undefined,
  };
  if (filters.from && filters.to && new Date(filters.from).getTime() > new Date(filters.to).getTime()) {
    throw new AppError(400, 'from must be earlier than or equal to to');
  }

  const eventFilters = {
    ...filters,
    limit: parseSafeLimit(req.query.limit, 100),
  };

  const legacySummary = isPostgresStateStoreEnabled()
    ? await queryWorkspaceMeteringSummary(workspaceId, filters)
    : getWorkspaceMeteringSummary(workspaceId, filters);

  if (!isFirestoreAiUsageAuthorityEnabled()) {
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
        ...legacySummary,
        aiCost: getWorkspaceAICostSummaryFromEvents(workspaceId, summaryEvents),
      },
      events: enrichWorkspaceUsageEventsWithAICost(workspaceId, sourceEvents),
    });
    return;
  }

  let authoritative;
  let authoritativeEvents;
  try {
    authoritative = await getAuthoritativeWorkspaceUsage(workspaceId);
    authoritativeEvents = !authoritative
      ? null
      : filters.resource && filters.resource !== 'aiQueries'
        ? { monthKey: authoritative.monthKey, events: [] }
        : await getAuthoritativeWorkspaceUsageEvents(workspaceId, {
          limit: eventFilters.limit,
          from: filters.from,
          to: filters.to,
        });
  } catch (error) {
    logger.error({ error, workspaceId, fallback: 'workspace-usage-authority-metering-read-failed' }, 'Failed to read authoritative metering');
    throw new AppError(503, 'Workspace usage authority is unavailable');
  }

  if (!authoritative || !authoritativeEvents) {
    if (isProductionAuthorityEnvironment()) {
      throw new AppError(503, 'Workspace usage authority is unavailable');
    }

    const summaryEvents = isPostgresStateStoreEnabled()
      ? await queryWorkspaceUsageEvents(workspaceId, filters)
      : getWorkspaceUsageEvents(workspaceId, filters);
    const sourceEvents = isPostgresStateStoreEnabled()
      ? await queryWorkspaceUsageEvents(workspaceId, eventFilters)
      : getWorkspaceUsageEvents(workspaceId, eventFilters);
    const aiCost = getWorkspaceAICostSummaryFromEvents(workspaceId, summaryEvents);
    res.json({
      scope: 'workspace',
      workspaceId,
      filters,
      summary: {
        ...legacySummary,
        aiCost,
        costCoverage: {
          aiQueries: {
            status: 'unavailable',
            reason: 'The enabled Firestore AI authority could not be read; development fallback is legacy-only.',
          },
        },
      },
      events: enrichWorkspaceUsageEventsWithAICost(workspaceId, sourceEvents),
    });
    return;
  }

  if (authoritative.monthKey !== authoritativeEvents.monthKey) {
    throw new AppError(503, 'Workspace usage authority is unavailable');
  }

  // Fetch all legacy events for the enabled path before removing the current
  // authoritative month. Applying the route limit first could leave a short
  // page after legacy AI rows are removed.
  const allLegacyEvents = isPostgresStateStoreEnabled()
    ? await queryWorkspaceUsageEvents(workspaceId, filters)
    : getWorkspaceUsageEvents(workspaceId, filters);
  const mergedSummaryEvents = mergeCurrentMonthAuthoritativeAiEvents({
    legacyEvents: allLegacyEvents,
    authoritativeEvents: authoritativeEvents.events,
    monthKey: authoritative.monthKey,
    filters,
  });
  const mergedEvents = mergeCurrentMonthAuthoritativeAiEvents({
    legacyEvents: allLegacyEvents,
    authoritativeEvents: authoritativeEvents.events,
    monthKey: authoritative.monthKey,
    filters,
    limit: eventFilters.limit,
  });
  const summary = replaceCurrentMonthAuthoritativeAiSummary({
    summary: legacySummary,
    monthKey: authoritative.monthKey,
    aiQueries: authoritative.usage.aiQueries,
    filters,
  });
  const aiCost = getWorkspaceAICostSummaryFromEvents(workspaceId, mergedSummaryEvents);

  res.json({
    scope: 'workspace',
    workspaceId,
    filters,
    summary: {
      ...summary,
      aiCost,
      costCoverage: {
        aiQueries: {
          status: aiCost.sampleCount > 0 ? 'partial' : 'unavailable',
          reason: aiCost.sampleCount > 0
            ? 'Current UTC-month authoritative AI usage events do not contain provider token metadata; aiCost contains legacy token samples only and is not complete billing evidence.'
            : 'No provider token metadata is available for the authoritative AI usage events in this result.',
        },
      },
    },
    events: enrichWorkspaceUsageEventsWithAICost(workspaceId, mergedEvents),
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
