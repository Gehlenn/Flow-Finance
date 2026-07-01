import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  logWarn: vi.fn(),
  demoPlan: { value: null as 'free' | 'pro' | null },
  trackProductEvent: vi.fn(),
}));

vi.mock('../../src/config/api.config', () => ({
  API_ENDPOINTS: {
    SAAS: {
      PLANS: '/api/saas/plans',
      STRIPE_CHECKOUT_SESSION: '/api/saas/stripe/checkout-session',
      STRIPE_PORTAL_SESSION: '/api/saas/stripe/portal-session',
    },
  },
  ApiRequestError: class ApiRequestError extends Error {
    statusCode: number;

    constructor(init: { statusCode: number; message: string }) {
      super(init.message);
      this.statusCode = init.statusCode;
    }
  },
  apiRequest: (...args: unknown[]) => apiMocks.apiRequest(...args),
  getAuthHeaders: vi.fn(() => ({})),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => apiMocks.logWarn(...args),
}));

vi.mock('../../src/demo/demoBootstrap', () => ({
  getDemoBootstrapPlan: () => apiMocks.demoPlan.value,
}));

vi.mock('../../src/app/productAnalytics', () => ({
  trackProductEvent: (...args: unknown[]) => apiMocks.trackProductEvent(...args),
}));

import { ApiRequestError } from '../../src/config/api.config';
import { MONETIZATION_PRICING } from '../../src/app/monetizationPlan';
import { getPlanLimits } from '../../src/saas/policyEngine';
import { createWorkspaceCheckoutSession, createWorkspacePortalSession, getWorkspacePlanCatalog } from '../../src/saas/billingClient';

describe('billingClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.demoPlan.value = null;
  });

  it('logs when falling back to the local plan catalog', async () => {
    apiMocks.apiRequest.mockRejectedValueOnce(new ApiRequestError({
      statusCode: 503,
      message: 'backend down',
    }));

    const catalog = await getWorkspacePlanCatalog({ workspaceId: 'ws-1', currentPlan: 'pro' });
    const freeLimits = getPlanLimits('free');
    const proLimits = getPlanLimits('pro');

    expect(catalog.billingProvider).toBe('mock');
    expect(catalog.plans).toHaveLength(2);
    expect(catalog.plans.find((plan) => plan.id === 'free')).toMatchObject({
      name: 'Free',
      priceMonthlyCents: 0,
      limits: {
        transactions: freeLimits.transactionsPerMonth,
        aiQueries: freeLimits.aiQueriesPerMonth,
        bankConnections: freeLimits.bankConnections,
      },
    });
    expect(catalog.plans.find((plan) => plan.id === 'pro')).toMatchObject({
      name: 'Pro',
      priceMonthlyCents: MONETIZATION_PRICING.proMonthlyBRL * 100,
      limits: {
        transactions: proLimits.transactionsPerMonth,
        aiQueries: proLimits.aiQueriesPerMonth,
        bankConnections: proLimits.bankConnections,
      },
    });
    expect(apiMocks.logWarn).toHaveBeenCalledWith(
      '[BillingClient] Falling back to local plan catalog',
      expect.objectContaining({
        workspaceId: 'ws-1',
        currentPlan: 'pro',
        error: expect.any(Error),
        fallback: 'billing-client-local-catalog-fallback',
      }),
    );
  });

  it('logs fallback when the catalog endpoint returns 404', async () => {
    apiMocks.apiRequest.mockRejectedValueOnce(new ApiRequestError({
      statusCode: 404,
      message: 'catalog not found',
    }));

    const catalog = await getWorkspacePlanCatalog({ workspaceId: 'ws-2' });

    expect(catalog.billingProvider).toBe('mock');
    expect(apiMocks.logWarn).toHaveBeenCalledWith(
      '[BillingClient] Falling back to local plan catalog',
      expect.objectContaining({
        workspaceId: 'ws-2',
        currentPlan: 'free',
        error: expect.any(Error),
        fallback: 'billing-client-local-catalog-fallback',
      }),
    );
  });

  it('returns a pro catalog without Stripe wiring when demo bootstrap is active', async () => {
    apiMocks.demoPlan.value = 'pro';

    const catalog = await getWorkspacePlanCatalog({ workspaceId: 'ws-demo', currentPlan: 'free' });

    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
    expect(catalog.currentPlan).toBe('pro');
    expect(catalog.billingProvider).toBe('none');
    expect(catalog.stripeConfigured).toBe(false);
    expect(catalog.stripePortalEnabled).toBe(false);
    expect(catalog.manualPlanChangeAllowed).toBe(false);
    expect(catalog.plans).toHaveLength(2);
    expect(catalog.plans.find((plan) => plan.id === 'pro')?.features).toContain(
      'Revisao semanal de caixa sem travar na consulta 21 do mes.',
    );
  });

  it('tracks checkout lifecycle and preserves the request failure signal', async () => {
    apiMocks.apiRequest.mockRejectedValueOnce(new ApiRequestError({
      statusCode: 503,
      message: 'checkout down',
    }));

    await expect(createWorkspaceCheckoutSession({
      workspaceId: 'ws-1',
      returnUrl: 'https://app.flow.test/settings',
      source: 'settings',
    })).rejects.toThrow('checkout down');

    expect(apiMocks.trackProductEvent).toHaveBeenNthCalledWith(1, 'billing_checkout_started', expect.objectContaining({
      source: 'settings',
    }));
    expect(apiMocks.trackProductEvent).toHaveBeenNthCalledWith(2, 'billing_checkout_failed', expect.objectContaining({
      source: 'settings',
      error_type: 'http_503',
    }));
  });

  it('tracks portal lifecycle and request failures', async () => {
    apiMocks.apiRequest.mockRejectedValueOnce(new Error('portal down'));

    await expect(createWorkspacePortalSession({
      workspaceId: 'ws-2',
      returnUrl: 'https://app.flow.test/settings',
      source: 'workspace_admin',
    })).rejects.toThrow('portal down');

    expect(apiMocks.trackProductEvent).toHaveBeenNthCalledWith(1, 'billing_portal_started', expect.objectContaining({
      source: 'workspace_admin',
    }));
    expect(apiMocks.trackProductEvent).toHaveBeenNthCalledWith(2, 'billing_portal_failed', expect.objectContaining({
      source: 'workspace_admin',
      error_type: 'request_failed',
    }));
  });
});
