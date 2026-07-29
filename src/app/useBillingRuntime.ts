import { useEffect } from 'react';

import type { BillingHookTransport } from '../saas';

export interface UseBillingRuntimeArgs {
  isDemoBootstrapActive: boolean;
  isE2EBootstrapActive: boolean;
  isLoggedIn: boolean;
  userId?: string | null;
  workspaceId?: string | null;
  configureBillingTransport: (transport: BillingHookTransport | null) => void;
  createBillingTransport: () => BillingHookTransport;
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
  createBillingTransport,
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
      return;
    }

    configureBillingTransport(createBillingTransport());

    return () => {
      configureBillingTransport(null);
    };
  }, [
    configureBillingTransport,
    createBillingTransport,
    isDemoBootstrapActive,
    isE2EBootstrapActive,
    isLoggedIn,
    userId,
    workspaceId,
  ]);
}
