import { AppError } from '../../middleware/errorHandler';
import { recordAuditEvent } from '../admin/auditLog';
import { getWorkspaceAsync, updateWorkspaceBilling } from '../admin/workspaceStore';
import {
  appendBillingHook,
  appendWorkspaceBillingHook,
  getUserPlan,
  getWorkspaceLimits,
  getWorkspacePlan,
  PLAN_LIMITS,
  setUserPlan,
  type BillingHookEvent,
  type BillingHookPayload,
  type PlanId,
} from '../../utils/saasStore';

type PlanCatalogEntry = {
  id: PlanId;
  name: string;
  priceMonthlyCents: number;
  currency: 'BRL';
  limits: typeof PLAN_LIMITS.free;
  features: string[];
};

type BillingProviderMode = 'stripe' | 'mock' | 'none';

type BillingCapabilities = {
  stripeConfigured: boolean;
  stripePortalEnabled: boolean;
  hasBillingCustomer: boolean;
  billingProvider: BillingProviderMode;
  manualPlanChangeAllowed: boolean;
};

type ChangeUserPlanInput = {
  userId: string;
  targetPlan: PlanId;
  ip?: string;
  userAgent?: string;
  source?: 'mock_api' | 'billing_hook';
};

type BillingHookInput = Omit<BillingHookPayload, 'userId'> & {
  userId: string;
  ip?: string;
  userAgent?: string;
};

export function isMockBillingEnabled(): boolean {
  return process.env.ALLOW_MOCK_BILLING_UPDATES === 'true' || process.env.NODE_ENV === 'test';
}

export function getPlanCatalog(userId: string): {
  currentPlan: PlanId;
  mockBillingEnabled: boolean;
  stripeConfigured: boolean;
  stripePortalEnabled: boolean;
  hasBillingCustomer: boolean;
  billingProvider: BillingProviderMode;
  manualPlanChangeAllowed: boolean;
  plans: PlanCatalogEntry[];
} {
  const capabilities = getBillingCapabilities();

  return {
    currentPlan: getUserPlan(userId),
    mockBillingEnabled: isMockBillingEnabled(),
    ...capabilities,
    plans: buildPlanCatalogEntries(),
  };
}

export async function getWorkspacePlanCatalog(workspaceId: string): Promise<{
  currentPlan: PlanId;
  mockBillingEnabled: boolean;
  stripeConfigured: boolean;
  stripePortalEnabled: boolean;
  hasBillingCustomer: boolean;
  billingProvider: BillingProviderMode;
  manualPlanChangeAllowed: boolean;
  plans: PlanCatalogEntry[];
}> {
  const workspace = await getWorkspaceAsync(workspaceId);
  if (!workspace) {
    throw new AppError(404, 'Workspace not found');
  }

  const capabilities = getBillingCapabilities(Boolean(workspace.billingCustomerId));

  return {
    currentPlan: workspace.plan,
    mockBillingEnabled: isMockBillingEnabled(),
    ...capabilities,
    plans: buildPlanCatalogEntries(workspaceId),
  };
}

export function changeUserPlan(input: ChangeUserPlanInput): {
  userId: string;
  previousPlan: PlanId;
  currentPlan: PlanId;
  changed: boolean;
  source: 'mock_api' | 'billing_hook';
} {
  if (!isMockBillingEnabled()) {
    throw new AppError(403, 'Mock billing updates are disabled in this environment');
  }

  return applyPlanChange({
    userId: input.userId,
    targetPlan: input.targetPlan,
    ip: input.ip,
    userAgent: input.userAgent,
    source: input.source || 'mock_api',
  });
}

export async function changeWorkspacePlan(input: {
  workspaceId: string;
  actorUserId: string;
  targetPlan: PlanId;
  ip?: string;
  userAgent?: string;
  source?: 'mock_api' | 'billing_hook';
  skipBillingHookAppend?: boolean;
}): Promise<{
  workspaceId: string;
  previousPlan: PlanId;
  currentPlan: PlanId;
  changed: boolean;
  source: 'mock_api' | 'billing_hook';
}> {
  if (!isMockBillingEnabled()) {
    throw new AppError(403, 'Mock billing updates are disabled in this environment');
  }

  const workspace = await getWorkspaceAsync(input.workspaceId);
  if (!workspace) {
    throw new AppError(404, 'Workspace not found');
  }

  const previousPlan = workspace.plan;
  const source = input.source || 'mock_api';

  if (previousPlan === input.targetPlan) {
    return {
      workspaceId: input.workspaceId,
      previousPlan,
      currentPlan: input.targetPlan,
      changed: false,
      source,
    };
  }

  updateWorkspaceBilling(input.workspaceId, {
    plan: input.targetPlan,
    billingEmail: workspace.billingEmail,
    billingCustomerId: workspace.billingCustomerId || `cust_${workspace.workspaceId}`,
    subscription: {
      subscriptionId: workspace.subscription?.subscriptionId || `sub_${workspace.workspaceId}`,
      provider: 'internal',
      status: input.targetPlan === 'pro' ? 'active' : 'canceled',
      plan: input.targetPlan,
      startedAt: workspace.subscription?.startedAt || new Date().toISOString(),
      renewsAt: input.targetPlan === 'pro' ? workspace.subscription?.renewsAt : undefined,
      canceledAt: input.targetPlan === 'free' ? new Date().toISOString() : undefined,
    },
  });

  if (!input.skipBillingHookAppend) {
    appendWorkspaceBillingHook(input.workspaceId, {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      plan: input.targetPlan,
      event: 'plan_changed',
      amount: 0,
      at: new Date().toISOString(),
      metadata: {
        previousPlan,
        source,
      },
    });
  }

  recordAuditEvent({
    userId: input.actorUserId,
    action: 'billing.plan_changed',
    status: 'success',
    resource: input.workspaceId,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: {
      previousPlan,
      currentPlan: input.targetPlan,
      source,
    },
  });

  return {
    workspaceId: input.workspaceId,
    previousPlan,
    currentPlan: input.targetPlan,
    changed: true,
    source,
  };
}

export function applyBillingHook(input: BillingHookInput): {
  previousPlan: PlanId;
  currentPlan: PlanId;
  changed: boolean;
  event: BillingHookEvent;
} {
  appendBillingHook(input.userId, {
    userId: input.userId,
    plan: input.plan,
    event: input.event,
    resource: input.resource,
    amount: input.amount,
    at: input.at,
    metadata: input.metadata,
  });

  if (input.event !== 'plan_changed') {
    const currentPlan = getUserPlan(input.userId);
    return {
      previousPlan: currentPlan,
      currentPlan,
      changed: false,
      event: input.event,
    };
  }

  const result = applyPlanChange({
    userId: input.userId,
    targetPlan: input.plan,
    ip: input.ip,
    userAgent: input.userAgent,
    source: 'billing_hook',
    skipBillingHookAppend: true,
  });

  return {
    previousPlan: result.previousPlan,
    currentPlan: result.currentPlan,
    changed: result.changed,
    event: input.event,
  };
}

export async function applyWorkspaceBillingHook(input: BillingHookInput & { workspaceId: string }): Promise<{
  previousPlan: PlanId;
  currentPlan: PlanId;
  changed: boolean;
  event: BillingHookEvent;
}> {
  appendWorkspaceBillingHook(input.workspaceId, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    plan: input.plan,
    event: input.event,
    resource: input.resource,
    amount: input.amount,
    at: input.at,
    metadata: input.metadata,
  });

  if (input.event !== 'plan_changed') {
    const currentPlan = getWorkspacePlan(input.workspaceId);
    return {
      previousPlan: currentPlan,
      currentPlan,
      changed: false,
      event: input.event,
    };
  }

  const result = await changeWorkspacePlan({
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    targetPlan: input.plan,
    ip: input.ip,
    userAgent: input.userAgent,
    source: 'billing_hook',
    skipBillingHookAppend: true,
  });

  return {
    previousPlan: result.previousPlan,
    currentPlan: result.currentPlan,
    changed: result.changed,
    event: input.event,
  };
}

function applyPlanChange(input: {
  userId: string;
  targetPlan: PlanId;
  ip?: string;
  userAgent?: string;
  source: 'mock_api' | 'billing_hook';
  skipBillingHookAppend?: boolean;
}): {
  userId: string;
  previousPlan: PlanId;
  currentPlan: PlanId;
  changed: boolean;
  source: 'mock_api' | 'billing_hook';
} {
  const previousPlan = getUserPlan(input.userId);

  if (previousPlan === input.targetPlan) {
    return {
      userId: input.userId,
      previousPlan,
      currentPlan: input.targetPlan,
      changed: false,
      source: input.source,
    };
  }

  setUserPlan(input.userId, input.targetPlan);

  if (!input.skipBillingHookAppend) {
    appendBillingHook(input.userId, {
      userId: input.userId,
      plan: input.targetPlan,
      event: 'plan_changed',
      amount: 0,
      at: new Date().toISOString(),
      metadata: {
        previousPlan,
        source: input.source,
      },
    });
  }

  recordAuditEvent({
    userId: input.userId,
    action: 'billing.plan_changed',
    status: 'success',
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: {
      previousPlan,
      currentPlan: input.targetPlan,
      source: input.source,
    },
  });

  return {
    userId: input.userId,
    previousPlan,
    currentPlan: input.targetPlan,
    changed: true,
    source: input.source,
  };
}

function getProMonthlyPriceCents(): number {
  const rawValue = process.env.SAAS_PRO_MONTHLY_PRICE_CENTS;
  const parsedValue = rawValue ? parseInt(rawValue, 10) : NaN;
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 2990;
}

function getBillingCapabilities(hasBillingCustomer = false): BillingCapabilities {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO_MONTHLY);
  const manualPlanChangeAllowed = isMockBillingEnabled();

  return {
    stripeConfigured,
    stripePortalEnabled: stripeConfigured && hasBillingCustomer,
    hasBillingCustomer,
    billingProvider: stripeConfigured ? 'stripe' : manualPlanChangeAllowed ? 'mock' : 'none',
    manualPlanChangeAllowed,
  };
}

function buildPlanCatalogEntries(workspaceId?: string): PlanCatalogEntry[] {
  return (Object.keys(PLAN_LIMITS) as PlanId[]).map((planId) => ({
    ...getPlanDefinition(planId),
    limits: workspaceId && planId === getWorkspacePlan(workspaceId) ? getWorkspaceLimits(workspaceId) : PLAN_LIMITS[planId],
  }));
}

function getPlanDefinition(planId: PlanId): Omit<PlanCatalogEntry, 'limits'> {
  if (planId === 'pro') {
    return {
      id: 'pro',
      name: 'Pro',
      priceMonthlyCents: getProMonthlyPriceCents(),
      currency: 'BRL',
      features: [
        '20 conexoes bancarias',
        '5.000 consultas de IA por mes',
        '10.000 transacoes mensais monitoradas',
      ],
    };
  }

  return {
    id: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    currency: 'BRL',
    features: [
      '1 conexao bancaria',
      '100 consultas de IA por mes',
      '500 transacoes mensais monitoradas',
    ],
  };
}
