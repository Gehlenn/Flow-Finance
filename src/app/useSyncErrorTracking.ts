import { useEffect } from 'react';

import type { ProductAnalyticsEvent, ProductAnalyticsProperties } from './productAnalytics';

export type SyncErrorTrackingEvent = (
  eventName: ProductAnalyticsEvent,
  properties?: ProductAnalyticsProperties,
) => void;

export interface UseSyncErrorTrackingArgs {
  syncStatus: string;
  activeTab: string;
  plan: string;
  trackEvent: SyncErrorTrackingEvent;
}

export function useSyncErrorTracking({
  syncStatus,
  activeTab,
  plan,
  trackEvent,
}: UseSyncErrorTrackingArgs): void {
  useEffect(() => {
    if (syncStatus !== 'error') {
      return;
    }

    trackEvent('integration_error_observed', {
      source: 'sync_engine',
      active_tab: activeTab,
      plan,
    });
  }, [activeTab, plan, syncStatus, trackEvent]);
}
