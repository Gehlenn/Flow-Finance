import { beforeEach, describe, expect, it, vi } from 'vitest';

const productAnalyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
  addBreadcrumb: vi.fn(),
  logWarn: vi.fn(),
  getAuthHeaders: vi.fn(() => ({
    Authorization: 'Bearer token',
    'x-workspace-id': 'ws-live',
    'Content-Type': 'application/json',
  })),
  getStoredWorkspaceId: vi.fn(() => 'ws-live'),
  fetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ event: { id: 'evt_product_1' } }),
  }),
}));

vi.mock('@vercel/analytics', () => ({
  track: productAnalyticsMocks.track,
}));

vi.mock('../../src/config/sentry', () => ({
  addBreadcrumb: productAnalyticsMocks.addBreadcrumb,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: productAnalyticsMocks.logWarn,
}));

vi.mock('../../src/config/api.config', () => ({
  API_ENDPOINTS: {
    FINANCE: {
      EVENTS: 'https://backend.test/api/finance/events',
    },
  },
  getAuthHeaders: (...args: unknown[]) => productAnalyticsMocks.getAuthHeaders(...args),
  getStoredWorkspaceId: () => productAnalyticsMocks.getStoredWorkspaceId(),
}));

import { trackProductEvent, trackProductEventOnce } from '../../src/app/productAnalytics';

describe('productAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubGlobal('fetch', productAnalyticsMocks.fetch as unknown as typeof fetch);
    productAnalyticsMocks.getStoredWorkspaceId.mockReturnValue('ws-live');
    productAnalyticsMocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ event: { id: 'evt_product_1' } }),
    });
  });

  it('tracks product events through Vercel Analytics and Sentry breadcrumb', () => {
    trackProductEvent('billing_checkout_started', {
      source: 'pricing',
      plan: 'pro',
      workspace_id: 'ws-1',
      user_email: 'owner@example.com',
      nested: { unsafe: true } as never,
    });

    expect(productAnalyticsMocks.track).toHaveBeenCalledWith('billing_checkout_started', {
      source: 'pricing',
      plan: 'pro',
    });
    expect(productAnalyticsMocks.addBreadcrumb).toHaveBeenCalledWith(
      'billing_checkout_started',
      'product-analytics',
      'info',
    );
    expect(productAnalyticsMocks.fetch).toHaveBeenCalledWith(
      'https://backend.test/api/finance/events',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'x-workspace-id': 'ws-live',
        }),
      }),
    );

    const remotePayload = JSON.parse(productAnalyticsMocks.fetch.mock.calls[0][1].body as string) as {
      type: string;
      aggregateType: string;
      payload: Record<string, unknown>;
      metadata: Record<string, unknown>;
    };
    expect(remotePayload).toMatchObject({
      type: 'billing_checkout_started',
      aggregateType: 'product_analytics',
      payload: {
        source: 'pricing',
        plan: 'pro',
      },
      metadata: {
        source: 'product_analytics',
        eventName: 'billing_checkout_started',
      },
    });
  });

  it('tracks once per event and scope', () => {
    const first = trackProductEventOnce('activation_first_transaction', 'workspace-1', {
      transaction_count: 1,
    });
    const second = trackProductEventOnce('activation_first_transaction', 'workspace-1', {
      transaction_count: 2,
    });
    const third = trackProductEventOnce('activation_first_transaction', 'workspace-2', {
      transaction_count: 1,
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(true);
    expect(productAnalyticsMocks.track).toHaveBeenCalledTimes(2);
    expect(productAnalyticsMocks.fetch).toHaveBeenCalledTimes(2);
    const storageKeys = Object.keys(window.localStorage);
    expect(storageKeys).toHaveLength(2);
    expect(storageKeys.join('|')).not.toContain('workspace-1');
    expect(storageKeys.join('|')).not.toContain('workspace-2');
  });

  it('does not break product flow when analytics provider fails', () => {
    productAnalyticsMocks.track.mockImplementationOnce(() => {
      throw new Error('analytics offline');
    });

    expect(() => trackProductEvent('integration_error_observed', { source: 'sync_engine' })).not.toThrow();
    expect(productAnalyticsMocks.logWarn).toHaveBeenCalledWith(
      '[ProductAnalytics] Failed to track product event',
      expect.objectContaining({
        eventName: 'integration_error_observed',
        fallback: 'product-analytics-track-failed',
      }),
    );
    expect(productAnalyticsMocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not attempt remote persistence without active workspace context', () => {
    productAnalyticsMocks.getStoredWorkspaceId.mockReturnValue(null);

    trackProductEvent('ai_consultation_completed', { source: 'ai_cfo' });

    expect(productAnalyticsMocks.track).toHaveBeenCalledWith('ai_consultation_completed', {
      source: 'ai_cfo',
    });
    expect(productAnalyticsMocks.fetch).not.toHaveBeenCalled();
  });

  it('does not break product flow when remote persistence fails', async () => {
    productAnalyticsMocks.fetch.mockRejectedValueOnce(new Error('backend offline'));

    expect(() => trackProductEvent('weekly_cash_review_completed', { source: 'weekly_cash_review' })).not.toThrow();
    await Promise.resolve();
    expect(productAnalyticsMocks.logWarn).toHaveBeenCalledWith(
      '[ProductAnalytics] Failed to persist product event remotely',
      expect.objectContaining({
        eventName: 'weekly_cash_review_completed',
        workspaceId: 'ws-live',
        fallback: 'product-analytics-remote-persist-failed',
      }),
    );
  });
});
