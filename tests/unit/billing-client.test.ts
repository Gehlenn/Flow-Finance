import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
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

import { ApiRequestError } from '../../src/config/api.config';
import { getWorkspacePlanCatalog } from '../../src/saas/billingClient';

describe('billingClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs when falling back to the local plan catalog', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    apiMocks.apiRequest.mockRejectedValueOnce(new ApiRequestError({
      statusCode: 503,
      message: 'backend down',
    }));

    const catalog = await getWorkspacePlanCatalog({ workspaceId: 'ws-1', currentPlan: 'pro' });

    expect(catalog.billingProvider).toBe('mock');
    expect(warnSpy).toHaveBeenCalledWith(
      '[BillingClient] Falling back to local plan catalog:',
      expect.objectContaining({ workspaceId: 'ws-1', error: expect.any(Error) }),
    );

    warnSpy.mockRestore();
  });
});
