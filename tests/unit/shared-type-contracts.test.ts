import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Tab } from '../../hooks/navigationTypes';
import type { NavigationRenderContext } from '../../hooks/useNavigationTabs';
import type { CashflowTimeframe } from '../../src/engines/finance/analyticsEngine';
import type { filterTransactionsByTimeframe } from '../../src/engines/finance/analyticsEngine';
import type { SubscriptionBillingCycle } from '../../src/ai/subscriptionDetectionCore';
import type { inferSubscriptionCycleFromDates } from '../../src/ai/subscriptionDetectionCore';
import type { BankSyncReport } from '../../src/finance/bankSyncTypes';
import type { getSyncReports } from '../../src/finance/bankSyncEngineHelpers';
import type { ProfileState } from '../../src/services/profileTypes';
import type { createDemoProfileState } from '../../src/demo/demoBootstrap';
import type { createDefaultLocalProfileState } from '../../src/services/localProfileStore';
import type { replaceSyncEntityCollection } from '../../src/services/sync/cloudSyncClient';
import type {
  SyncEntity,
  SyncEntityIdMap,
  SyncStatus,
} from '../../src/services/sync/syncTypes';
import type { shouldShowTopStatus } from '../../src/app/appShellLayout';

describe('shared type ownership contracts', () => {
  it('keeps consumers attached to their canonical type owners', () => {
    expectTypeOf<Parameters<NavigationRenderContext['onNavigateToTab']>[0]>()
      .toEqualTypeOf<Tab>();
    expectTypeOf<Parameters<typeof filterTransactionsByTimeframe>[1]>()
      .toEqualTypeOf<CashflowTimeframe>();
    expectTypeOf<ReturnType<typeof inferSubscriptionCycleFromDates>>()
      .toEqualTypeOf<SubscriptionBillingCycle>();
    expectTypeOf<ReturnType<typeof getSyncReports>>()
      .toEqualTypeOf<BankSyncReport[]>();
    expectTypeOf<ReturnType<typeof createDemoProfileState>>()
      .toEqualTypeOf<ProfileState>();
    expectTypeOf<ReturnType<typeof createDefaultLocalProfileState>>()
      .toEqualTypeOf<ProfileState>();
    expectTypeOf<Parameters<typeof replaceSyncEntityCollection>[0]>()
      .toEqualTypeOf<SyncEntity>();
    expectTypeOf<Parameters<typeof shouldShowTopStatus>[0]['syncStatus']>()
      .toEqualTypeOf<SyncStatus>();
    expectTypeOf<SyncEntityIdMap>().toEqualTypeOf<Record<string, string>>();

    expect(true).toBe(true);
  });
});
