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

const appAnalyticsMocks = vi.hoisted(() => ({
  trackProductEventMock: vi.fn(),
  trackProductEventOnceMock: vi.fn(() => true),
}));

const appAuthState = vi.hoisted(() => ({
  auth: {
    user: { id: 'user-1', name: 'Ada' as string | null, email: 'ada@flow.test' },
    activeWorkspace: {
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      tenantName: 'Tenant',
      name: 'Workspace',
      plan: 'free',
      role: 'owner',
    },
    isE2EBootstrapActive: false,
    isDemoBootstrapActive: false,
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
  },
}));

const appSyncState = vi.hoisted(() => ({
  profile: { name: 'Alice' as string | null, theme: 'light' as 'light' | 'dark' },
  isProfileReady: true,
  hasLoadedEntities: true,
  syncStatus: 'synced',
  syncProfile: vi.fn(),
}));

vi.mock('../../src/app/productAnalytics', () => ({
  trackProductEvent: appAnalyticsMocks.trackProductEventMock,
  trackProductEventOnce: appAnalyticsMocks.trackProductEventOnceMock,
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
  createHttpBillingTransport: vi.fn(() => ({})),
}));

vi.mock('../../hooks/useAuthAndWorkspace', () => ({
  useAuthAndWorkspace: () => appAuthState.auth,
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
  useSyncEngine: () => appSyncState,
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
    appAnalyticsMocks.trackProductEventMock.mockReset();
    appAnalyticsMocks.trackProductEventOnceMock.mockReset();
    appAnalyticsMocks.trackProductEventOnceMock.mockReturnValue(true);
    appAuthState.auth.user.name = 'Ada';
    appSyncState.profile.name = 'Alice';
    localStorage.clear();
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

  it('registra return_visit quando o shell principal carrega com workspace ativo', () => {
    render(<App />);

    expect(appAnalyticsMocks.trackProductEventMock).toHaveBeenCalledWith(
      'return_visit',
      expect.objectContaining({
        source: 'app_shell',
        has_workspace: true,
        plan: 'free',
      }),
    );
  });

  it('registra onboarding_started quando o perfil ainda nao tem nome', () => {
    appAuthState.auth.user.name = null;
    appSyncState.profile.name = null;

    render(<App />);

    expect(appAnalyticsMocks.trackProductEventOnceMock).toHaveBeenCalledWith(
      'onboarding_started',
      'workspace-1',
      expect.objectContaining({
        source: 'app_shell',
        plan: 'free',
        has_workspace: true,
        has_profile_name: false,
        entry_point: 'name_prompt',
      }),
    );
  });
});
