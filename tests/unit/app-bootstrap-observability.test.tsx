import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType, ReactNode } from 'react';

type ErrorBoundaryProps = {
  children?: ReactNode;
  onError?: (error: Error, info: { componentStack?: string }) => void;
};

const { logErrorMock } = vi.hoisted(() => ({
  logErrorMock: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logError: logErrorMock,
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
  configureBillingTransport: vi.fn(),
  configureUsageStoreAdapter: vi.fn(),
  createFirestoreBillingTransport: vi.fn(() => ({})),
  createFirestoreUsageStoreAdapter: vi.fn(() => ({})),
  resetUsageStoreAdapter: vi.fn(),
}));

vi.mock('../../hooks/useAuthAndWorkspace', () => ({
  useAuthAndWorkspace: () => ({
    user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    activeWorkspace: {
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      tenantName: 'Tenant',
      name: 'Workspace',
      plan: 'free',
      role: 'owner',
    },
    isE2EBootstrapActive: false,
    cloudSyncEnabled: true,
    backendSyncEnabled: true,
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
    profile: { name: 'Alice', theme: 'light' },
    isProfileReady: true,
    hasLoadedEntities: true,
    syncStatus: 'synced',
    syncProfile: vi.fn(),
  }),
}));

vi.mock('../../src/app/mainNavigation', () => ({
  getActiveNavigationSection: () => ({
    id: 'cash',
    label: 'Caixa',
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

describe('App bootstrap observability', () => {
  beforeEach(() => {
    logErrorMock.mockReset();
  });

  it('registra erro quando o boundary captura uma falha', () => {
    render(<App />);

    expect(logErrorMock).toHaveBeenCalledWith(
      '[App] Error caught by boundary',
      expect.any(Error),
      expect.objectContaining({
        fallback: 'app-error-boundary-caught',
      }),
    );
  });
});
