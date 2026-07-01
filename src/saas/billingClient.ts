import {
  API_ENDPOINTS,
  ApiRequestError,
  apiRequest,
  getAuthHeaders,
} from '../config/api.config';
import { getDemoBootstrapPlan } from '../demo/demoBootstrap';
import {
  MONETIZATION_PRICING,
  getPlanFeatureMessages,
  getPlanPackaging,
} from '../app/monetizationPlan';
import { trackProductEvent } from '../app/productAnalytics';
import { logWarn } from '../utils/logger';
import { getPlanLimits } from './policyEngine';

export type WorkspacePlanCatalog = {
  scope: 'workspace';
  workspaceId: string;
  currentPlan: 'free' | 'pro';
  mockBillingEnabled: boolean;
  stripeConfigured: boolean;
  stripePortalEnabled: boolean;
  hasBillingCustomer: boolean;
  billingProvider: 'stripe' | 'mock' | 'none';
  manualPlanChangeAllowed: boolean;
  plans: Array<{
    id: 'free' | 'pro';
    name: string;
    priceMonthlyCents: number;
    currency: 'BRL';
    limits: {
      transactions: number;
      aiQueries: number;
      bankConnections: number;
    };
    features: string[];
  }>;
};

type StripeSessionResponse = {
  id?: string;
  url: string | null;
};

type StripePortalResponse = {
  url: string;
};

type BillingAnalyticsSource = 'pricing' | 'upgrade_prompt' | 'settings' | 'workspace_admin' | 'unknown';

function createLocalBillingPlans(): WorkspacePlanCatalog['plans'] {
  return (['free', 'pro'] as const).map((planId) => {
    const plan = getPlanPackaging(planId);
    const limits = getPlanLimits(planId);

    return {
      id: planId,
      name: plan.label,
      priceMonthlyCents: planId === 'pro' ? MONETIZATION_PRICING.proMonthlyBRL * 100 : 0,
      currency: 'BRL',
      limits: {
        transactions: limits.transactionsPerMonth,
        aiQueries: limits.aiQueriesPerMonth,
        bankConnections: limits.bankConnections,
      },
      features: getPlanFeatureMessages(planId),
    };
  });
}

function createFallbackPlanCatalog(workspaceId: string, currentPlan: 'free' | 'pro' = 'free'): WorkspacePlanCatalog {
  return {
    scope: 'workspace',
    workspaceId,
    currentPlan,
    mockBillingEnabled: true,
    stripeConfigured: false,
    stripePortalEnabled: false,
    hasBillingCustomer: false,
    billingProvider: 'mock',
    manualPlanChangeAllowed: true,
    plans: createLocalBillingPlans(),
  };
}

function createDemoPlanCatalog(workspaceId: string, currentPlan: 'free' | 'pro'): WorkspacePlanCatalog {
  return {
    scope: 'workspace',
    workspaceId,
    currentPlan,
    mockBillingEnabled: false,
    stripeConfigured: false,
    stripePortalEnabled: false,
    hasBillingCustomer: false,
    billingProvider: 'none',
    manualPlanChangeAllowed: false,
    plans: createLocalBillingPlans(),
  };
}

export async function getWorkspacePlanCatalog(input: {
  workspaceId: string;
  currentPlan?: 'free' | 'pro';
}): Promise<WorkspacePlanCatalog> {
  const demoPlan = getDemoBootstrapPlan();
  if (demoPlan) {
    return createDemoPlanCatalog(input.workspaceId, demoPlan);
  }

  try {
    return await apiRequest<WorkspacePlanCatalog>(API_ENDPOINTS.SAAS.PLANS, {
      method: 'GET',
      headers: getAuthHeaders({ workspaceId: input.workspaceId }),
      timeout: 3000,
      retries: 0,
      silent: true,
    });
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.statusCode >= 500 || error.statusCode === 404) {
      logWarn('[BillingClient] Falling back to local plan catalog', {
        workspaceId: input.workspaceId,
        error: error instanceof Error ? error : new Error(String(error)),
        currentPlan: input.currentPlan ?? 'free',
        fallback: 'billing-client-local-catalog-fallback',
      });
      return createFallbackPlanCatalog(input.workspaceId, input.currentPlan);
    }

    throw error;
  }
}

export async function createWorkspaceCheckoutSession(input: {
  workspaceId: string;
  returnUrl: string;
  source?: BillingAnalyticsSource;
}): Promise<StripeSessionResponse> {
  trackProductEvent('billing_checkout_started', {
    workspace_id: input.workspaceId,
    source: input.source || 'unknown',
  });

  return await apiRequest<StripeSessionResponse>(API_ENDPOINTS.SAAS.STRIPE_CHECKOUT_SESSION, {
    method: 'POST',
    headers: getAuthHeaders({ workspaceId: input.workspaceId }),
    body: JSON.stringify({ returnUrl: input.returnUrl }),
  }).catch((error) => {
    trackProductEvent('billing_checkout_failed', {
      workspace_id: input.workspaceId,
      source: input.source || 'unknown',
      error_type: error instanceof ApiRequestError ? `http_${error.statusCode}` : 'request_failed',
    });
    throw error;
  });
}

export async function createWorkspacePortalSession(input: {
  workspaceId: string;
  returnUrl: string;
  source?: BillingAnalyticsSource;
}): Promise<StripePortalResponse> {
  trackProductEvent('billing_portal_started', {
    workspace_id: input.workspaceId,
    source: input.source || 'unknown',
  });

  return await apiRequest<StripePortalResponse>(API_ENDPOINTS.SAAS.STRIPE_PORTAL_SESSION, {
    method: 'POST',
    headers: getAuthHeaders({ workspaceId: input.workspaceId }),
    body: JSON.stringify({ returnUrl: input.returnUrl }),
  }).catch((error) => {
    trackProductEvent('billing_portal_failed', {
      workspace_id: input.workspaceId,
      source: input.source || 'unknown',
      error_type: error instanceof ApiRequestError ? `http_${error.statusCode}` : 'request_failed',
    });
    throw error;
  });
}
