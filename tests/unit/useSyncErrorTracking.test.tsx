import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSyncErrorTracking } from '../../src/app/useSyncErrorTracking';

describe('useSyncErrorTracking', () => {
  it('registra erro de sincronizacao apenas quando o status e error', () => {
    const trackEvent = vi.fn();

    const { rerender } = renderHook(({ syncStatus, activeTab, plan }) => useSyncErrorTracking({
      syncStatus,
      activeTab,
      plan,
      trackEvent,
    }), {
      initialProps: {
        syncStatus: 'synced',
        activeTab: 'dashboard',
        plan: 'free',
      },
    });

    expect(trackEvent).not.toHaveBeenCalled();

    rerender({
      syncStatus: 'error',
      activeTab: 'transactions',
      plan: 'pro',
    });

    expect(trackEvent).toHaveBeenCalledWith('integration_error_observed', {
      source: 'sync_engine',
      active_tab: 'transactions',
      plan: 'pro',
    });
  });
});
