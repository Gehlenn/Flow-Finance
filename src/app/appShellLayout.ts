import type { SyncStatus } from '../services/sync/syncTypes';

const FAB_ENABLED_TABS = new Set(['dashboard']);
const WIDE_CONTENT_TABS = new Set(['dashboard', 'history', 'flow']);

export function shouldShowTopStatus(input: {
  isDemoBootstrapActive: boolean;
  syncStatus: SyncStatus;
}): boolean {
  return (
    input.isDemoBootstrapActive
    || input.syncStatus === 'syncing'
    || input.syncStatus === 'synced'
    || input.syncStatus === 'error'
  );
}

export function getActiveTabContainerClass(activeTab: string): string {
  if (activeTab === 'cfo') {
    return 'max-w-4xl';
  }

  return WIDE_CONTENT_TABS.has(activeTab) ? 'max-w-6xl' : 'max-w-xl';
}

export function shouldShowFloatingEntryButton(activeTab: string): boolean {
  return FAB_ENABLED_TABS.has(activeTab);
}

export function getShellContentSpacingClass(showTopStatus: boolean): string {
  return showTopStatus ? 'pt-12 md:pt-16' : 'pt-4 md:pt-5';
}
