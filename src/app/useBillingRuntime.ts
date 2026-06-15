import { useEffect } from 'react';

import type { BillingHookTransport, UsageStoreAdapter } from '../saas';

export interface UseBillingRuntimeArgs {
  isDemoBootstrapActive: boolean;
  isE2EBootstrapActive: boolean;
  isLoggedIn: boolean;
  userId?: string | null;
  workspaceId?: string | null;
  configureBillingTransport: (transport: BillingHookTransport | null) => void;
  configureUsageStoreAdapter: (adapter: UsageStoreAdapter) => Promise<void> | void;
  resetUsageStoreAdapter: () => Promise<void> | void;
  createBillingTransport: () => BillingHookTransport;
  createUsageStoreAdapter: () => UsageStoreAdapter;
}

function shouldDisableBillingRuntime({
  isDemoBootstrapActive,
  isE2EBootstrapActive,
  isLoggedIn,
  userId,
  workspaceId,
}: Pick<
  UseBillingRuntimeArgs,
  'isDemoBootstrapActive' | 'isE2EBootstrapActive' | 'isLoggedIn' | 'userId' | 'workspaceId'
>): boolean {
  return (
    isDemoBootstrapActive ||
    isE2EBootstrapActive ||
    !isLoggedIn ||
    !userId ||
    !workspaceId
  );
}

export function useBillingRuntime({
  isDemoBootstrapActive,
  isE2EBootstrapActive,
  isLoggedIn,
  userId,
  workspaceId,
  configureBillingTransport,
  configureUsageStoreAdapter,
  resetUsageStoreAdapter,
  createBillingTransport,
  createUsageStoreAdapter,
}: UseBillingRuntimeArgs): void {
  useEffect(() => {
    if (shouldDisableBillingRuntime({
      isDemoBootstrapActive,
      isE2EBootstrapActive,
      isLoggedIn,
      userId,
      workspaceId,
    })) {
      configureBillingTransport(null);
      void resetUsageStoreAdapter();
      return;
    }

    configureBillingTransport(createBillingTransport());
    void configureUsageStoreAdapter(createUsageStoreAdapter());

    return () => {
      configureBillingTransport(null);
      void resetUsageStoreAdapter();
    };
  }, [
    configureBillingTransport,
    configureUsageStoreAdapter,
    createBillingTransport,
    createUsageStoreAdapter,
    isDemoBootstrapActive,
    isE2EBootstrapActive,
    isLoggedIn,
    resetUsageStoreAdapter,
    userId,
    workspaceId,
  ]);
}
