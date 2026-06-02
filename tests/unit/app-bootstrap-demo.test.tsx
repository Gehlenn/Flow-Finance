import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

type ErrorBoundaryProps = {
  children?: ReactNode;
  onError?: (error: Error, info: { componentStack?: string }) => void;
};

const appBootstrapDemoMocks = vi.hoisted(() => ({
  logErrorMock: vi.fn(),
  configureBillingTransportMock: vi.fn(),
  configureUsageStoreAdapterMock: vi.fn(),
  resetUsageStoreAdapterMock: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logError: appBootstrapDemoMocks.logErrorMock,
}));

vi.mock('../../src/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children, onError }: ErrorBoundaryProps) => {
    onError?.(new Error('boundary boom'), { componentStack: 'stack' });
    return <>{children}</>;
  },
}));

vi.mock('../../services/firebase', () => ({
  isFirebaseConfigured: true,
}));

vi.mock('../../src/config/sentry', () => ({
  addBreadcrumb: vi.fn(),
  initSentry: vi.fn(),
}));

vi.mock('../../src/saas', () => ({
  configureBillingTransport: appBootstrapDemoMocks.configureBillingTransportMock,
  configureUsageStoreAdapter: appBootstrapDemoMocks.configureUsageStoreAdapterMock,
  createFirestoreBillingTransport: vi.fn(() => ({})),
  createFirestoreUsageStoreAdapter: vi.fn(() => ({})),
  resetUsageStoreAdapter: appBootstrapDemoMocks.resetUsageStoreAdapterMock,
}));

vi.mock('../../hooks/useAuthAndWorkspace', () => ({
  useAuthAndWorkspace: () => ({
    user: { id: 'demo-user-1', name: 'Demo', email: 'demo@flow.dev' },
    activeWorkspace: {
      tenantId: 'tenant-demo-1',
      workspaceId: 'ws-demo-1',
      tenantName: 'Tenant Demo',
      name: 'Workspace Demo',
      plan: 'free',
      role: 'owner',
    },
    isE2EBootstrapActive: false,
    isDemoBootstrapActive: true,
    cloudSyncEnabled: false,
    backendSyncEnabled: false,
    isInitialLoading: false,
    isLoggedIn: true,
    setCloudSyncEnabled: vi.fn(),
    setBackendSyncEnabled: vi.fn(),
    setUserName: vi.fn(),
    handleLogout: vi.fn(),
    handleLogin: vi.fn(),
    handleDevelopmentLogin: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFinancialState', () => ({
  useFinancialState: () => ({
    transactions: [],
    accounts: [],
    alerts: [],
    reminders: [],
    goals: [],
    addTransactions: vi.fn(),
    deleteTransaction: vi.fn(),
    deleteTransactions: vi.fn(),
    updateTransaction: vi.fn(),
    createAccount: vi.fn(),
    deleteAccount: vi.fn(),
    updateAccount: vi.fn(),
    createGoal: vi.fn(),
    deleteGoal: vi.fn(),
    contributeGoal: vi.fn(),
    updateGoal: vi.fn(),
    toggleReminder: vi.fn(),
    deleteReminder: vi.fn(),
    addReminder: vi.fn(),
    updateReminder: vi.fn(),
    addAlert: vi.fn(),
    deleteAlert: vi.fn(),
  }),
}));

vi.mock('../../hooks/useNavigationTabs', () => ({
  useNavigationTabs: () => ({
    activeTab: 'dashboard',
    setActiveTab: vi.fn(),
    renderActiveTab: () => <div data-testid="active-tab">Dashboard</div>,
  }),
}));

vi.mock('../../hooks/useSyncEngine', () => ({
  useSyncEngine: () => ({
    profile: { name: 'Demo', theme: 'light' },
    isProfileReady: true,
    hasLoadedEntities: true,
    syncStatus: 'synced',
    syncProfile: vi.fn(),
  }),
}));

vi.mock('../../src/app/mainNavigation', () => ({
  getActiveNavigationSection: () => ({
    id: 'cash',
    label: 'Dashboard',
    defaultTab: 'dashboard',
    items: [{ tab: 'dashboard', label: 'Dashboard' }],
  }),
  getMainNavigationItems: () => [
    { tab: 'dashboard', label: 'Dashboard' },
  ],
}));

vi.mock('../../components/Login', () => ({
  default: () => <div data-testid="login" />,
}));
vi.mock('../../components/NamePromptModal', () => ({
  default: () => <div data-testid="name-prompt" />,
}));
vi.mock('../../components/AIInput', () => ({
  default: () => <div data-testid="ai-input" />,
}));
vi.mock('../../components/dev/AIDebugPanel', () => ({
  default: () => <div data-testid="ai-debug" />,
}));
vi.mock('../../components/dev/AITaskQueueMonitor', () => ({
  default: () => <div data-testid="ai-queue" />,
}));

import App from '../../App';

describe('App bootstrap demo mode', () => {
  beforeEach(() => {
    appBootstrapDemoMocks.logErrorMock.mockReset();
    appBootstrapDemoMocks.configureBillingTransportMock.mockReset();
    appBootstrapDemoMocks.configureUsageStoreAdapterMock.mockReset();
    appBootstrapDemoMocks.resetUsageStoreAdapterMock.mockReset();
  });

  it('desliga os adaptadores do Firestore no bootstrap demo', () => {
    render(<App />);

    expect(appBootstrapDemoMocks.configureBillingTransportMock).toHaveBeenCalledWith(null);
    expect(appBootstrapDemoMocks.resetUsageStoreAdapterMock).toHaveBeenCalled();
    expect(appBootstrapDemoMocks.configureUsageStoreAdapterMock).not.toHaveBeenCalled();
  });
});
