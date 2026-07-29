import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useBillingRuntime } from '../../src/app/useBillingRuntime';

describe('useBillingRuntime', () => {
  it('desliga billing quando o app nao deve manter runtime de billing', async () => {
    const configureBillingTransport = vi.fn();
    const createBillingTransport = vi.fn();

    renderHook(() => useBillingRuntime({
      isDemoBootstrapActive: true,
      isE2EBootstrapActive: false,
      isLoggedIn: true,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      configureBillingTransport,
      createBillingTransport,
    }));

    await waitFor(() => {
      expect(configureBillingTransport).toHaveBeenCalledWith(null);
    });

    expect(createBillingTransport).not.toHaveBeenCalled();
  });

  it('configura billing quando o app esta em runtime ativo', async () => {
    const configureBillingTransport = vi.fn();
    const billingTransport = vi.fn();
    const createBillingTransport = vi.fn(() => billingTransport);

    const { unmount } = renderHook(() => useBillingRuntime({
      isDemoBootstrapActive: false,
      isE2EBootstrapActive: false,
      isLoggedIn: true,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      configureBillingTransport,
      createBillingTransport,
    }));

    await waitFor(() => {
      expect(configureBillingTransport).toHaveBeenCalledWith(billingTransport);
    });

    expect(createBillingTransport).toHaveBeenCalledTimes(1);

    unmount();

    expect(configureBillingTransport).toHaveBeenLastCalledWith(null);
  });
});
