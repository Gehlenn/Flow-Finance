import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  logWarn: vi.fn(),
  demoPlan: { value: null as 'free' | 'pro' | null },
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

import { ApiRequestError } from '../../src/config/api.config';
import { getWorkspacePlanCatalog } from '../../src/saas/billingClient';

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

    expect(catalog.billingProvider).toBe('mock');
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
  });
});
