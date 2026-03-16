import { AppError } from '../../middleware/errorHandler';
import { recordAuditEvent } from '../admin/auditLog';
import {
  appendBillingHook,
  getUserPlan,
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
  plans: PlanCatalogEntry[];
} {
  const currentPlan = getUserPlan(userId);

  return {
    currentPlan,
    mockBillingEnabled: isMockBillingEnabled(),
    plans: (Object.keys(PLAN_LIMITS) as PlanId[]).map((planId) => ({
      ...getPlanDefinition(planId),
      limits: PLAN_LIMITS[planId],
    })),
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

function getPlanDefinition(planId: PlanId): Omit<PlanCatalogEntry, 'limits'> {
  if (planId === 'pro') {
    return {
      id: 'pro',
      name: 'Pro',
      priceMonthlyCents: getProMonthlyPriceCents(),
      currency: 'BRL',
      features: [
        '20 conexões bancárias',
        '5.000 consultas de IA por mês',
        '10.000 transações mensais monitoradas',
      ],
    };
  }

  return {
    id: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    currency: 'BRL',
    features: [
      '1 conexão bancária',
      '100 consultas de IA por mês',
      '500 transações mensais monitoradas',
    ],
  };
}