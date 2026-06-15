import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useBillingRuntime } from '../../src/app/useBillingRuntime';

describe('useBillingRuntime', () => {
  it('desliga billing e reseta usage quando o app nao deve manter runtime de billing', async () => {
    const configureBillingTransport = vi.fn();
    const configureUsageStoreAdapter = vi.fn();
    const resetUsageStoreAdapter = vi.fn().mockResolvedValue(undefined);
    const createBillingTransport = vi.fn();
    const createUsageStoreAdapter = vi.fn();

    renderHook(() => useBillingRuntime({
      isDemoBootstrapActive: true,
      isE2EBootstrapActive: false,
      isLoggedIn: true,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      configureBillingTransport,
      configureUsageStoreAdapter,
      resetUsageStoreAdapter,
      createBillingTransport,
      createUsageStoreAdapter,
    }));

    await waitFor(() => {
      expect(configureBillingTransport).toHaveBeenCalledWith(null);
    });

    expect(resetUsageStoreAdapter).toHaveBeenCalledTimes(1);
    expect(createBillingTransport).not.toHaveBeenCalled();
    expect(createUsageStoreAdapter).not.toHaveBeenCalled();
    expect(configureUsageStoreAdapter).not.toHaveBeenCalled();
  });

  it('configura billing e usage quando o app esta em runtime ativo', async () => {
    const configureBillingTransport = vi.fn();
    const configureUsageStoreAdapter = vi.fn().mockResolvedValue(undefined);
    const resetUsageStoreAdapter = vi.fn().mockResolvedValue(undefined);
    const billingTransport = vi.fn();
    const usageAdapter = { read: vi.fn(), write: vi.fn() };
    const createBillingTransport = vi.fn(() => billingTransport);
    const createUsageStoreAdapter = vi.fn(() => usageAdapter);

    const { unmount } = renderHook(() => useBillingRuntime({
      isDemoBootstrapActive: false,
      isE2EBootstrapActive: false,
      isLoggedIn: true,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      configureBillingTransport,
      configureUsageStoreAdapter,
      resetUsageStoreAdapter,
      createBillingTransport,
      createUsageStoreAdapter,
    }));

    await waitFor(() => {
      expect(configureBillingTransport).toHaveBeenCalledWith(billingTransport);
    });

    expect(createBillingTransport).toHaveBeenCalledTimes(1);
    expect(createUsageStoreAdapter).toHaveBeenCalledTimes(1);
    expect(configureUsageStoreAdapter).toHaveBeenCalledWith(usageAdapter);

    unmount();

    expect(configureBillingTransport).toHaveBeenLastCalledWith(null);
    expect(resetUsageStoreAdapter).toHaveBeenCalled();
  });
});
