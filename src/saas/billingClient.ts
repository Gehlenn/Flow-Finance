import {
  API_ENDPOINTS,
  ApiRequestError,
  apiRequest,
  getAuthHeaders,
} from '../config/api.config';

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
    plans: [],
  };
}

export async function getWorkspacePlanCatalog(input: {
  workspaceId: string;
  currentPlan?: 'free' | 'pro';
}): Promise<WorkspacePlanCatalog> {
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
      return createFallbackPlanCatalog(input.workspaceId, input.currentPlan);
    }

    throw error;
  }
}

export async function createWorkspaceCheckoutSession(input: {
  workspaceId: string;
  returnUrl: string;
}): Promise<StripeSessionResponse> {
  return await apiRequest<StripeSessionResponse>(API_ENDPOINTS.SAAS.STRIPE_CHECKOUT_SESSION, {
    method: 'POST',
    headers: getAuthHeaders({ workspaceId: input.workspaceId }),
    body: JSON.stringify({ returnUrl: input.returnUrl }),
  });
}

export async function createWorkspacePortalSession(input: {
  workspaceId: string;
  returnUrl: string;
}): Promise<StripePortalResponse> {
  return await apiRequest<StripePortalResponse>(API_ENDPOINTS.SAAS.STRIPE_PORTAL_SESSION, {
    method: 'POST',
    headers: getAuthHeaders({ workspaceId: input.workspaceId }),
    body: JSON.stringify({ returnUrl: input.returnUrl }),
  });
}
