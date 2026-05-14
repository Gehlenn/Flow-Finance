import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  logWarn: vi.fn(),
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

import { ApiRequestError } from '../../src/config/api.config';
import { getWorkspacePlanCatalog } from '../../src/saas/billingClient';

describe('billingClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
