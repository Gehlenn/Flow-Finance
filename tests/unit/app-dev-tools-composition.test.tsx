import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

type ErrorBoundaryProps = {
  children?: ReactNode;
  onError?: (error: Error, info: { componentStack?: string }) => void;
};

const appDevToolsMocks = vi.hoisted(() => ({
  userEmail: 'dev@flow.test',
  setActiveTabMock: vi.fn(),
  renderActiveTabMock: vi.fn(() => <div data-testid="active-tab">Mock tab</div>),
  logErrorMock: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logError: appDevToolsMocks.logErrorMock,
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
    user: {
      id: 'user-1',
      name: 'Dev User',
      email: appDevToolsMocks.userEmail,
    },
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
  }),
}));

vi.mock('../../hooks/useFinancialState', () => ({
  useFinancialState: () => ({
    transactions: [],
    accounts: [],
    alerts: [],
    reminders: [],
    goals: [],
    latestLeaks: [],
    latestReport: null,
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
    activeTab: 'aicontrol',
    setActiveTab: appDevToolsMocks.setActiveTabMock,
    renderActiveTab: appDevToolsMocks.renderActiveTabMock,
  }),
}));

vi.mock('../../hooks/useSyncEngine', () => ({
  useSyncEngine: () => ({
    profile: { name: 'Dev User', theme: 'light' },
    isProfileReady: true,
    hasLoadedEntities: true,
    syncStatus: 'synced',
    syncProfile: vi.fn(),
  }),
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
  default: () => <div data-testid="ai-debug-panel" />,
}));
vi.mock('../../components/dev/AITaskQueueMonitor', () => ({
  default: () => <div data-testid="ai-queue-monitor" />,
}));

describe('App dev tools composition', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    appDevToolsMocks.userEmail = 'dev@flow.test';
    appDevToolsMocks.setActiveTabMock.mockReset();
    appDevToolsMocks.renderActiveTabMock.mockClear();
    appDevToolsMocks.logErrorMock.mockReset();
  });

  async function renderAppWithEmail(email: string) {
    appDevToolsMocks.userEmail = email;
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_DEV_ACCOUNT_EMAILS', 'dev@flow.test');

    const { default: App } = await import('../../App');
    render(<App />);
  }

  it('shows Lab IA, Performance and dev panels for allowlisted dev accounts', async () => {
    await renderAppWithEmail('dev@flow.test');

    expect(await screen.findByRole('button', { name: 'IA' })).toBeTruthy();
    expect(await screen.findByLabelText('IA subsecoes')).toBeTruthy();
    expect(await screen.findByRole('tab', { name: 'Lab IA' })).toBeTruthy();
    expect(await screen.findByRole('tab', { name: 'Performance' })).toBeTruthy();
    expect(await screen.findByTestId('ai-debug-panel')).toBeTruthy();
    expect(await screen.findByTestId('ai-queue-monitor')).toBeTruthy();
  });

  it('hides Lab IA, Performance and dev panels for non-dev accounts', async () => {
    await renderAppWithEmail('regular@flow.test');

    expect(await screen.findByRole('button', { name: 'IA' })).toBeTruthy();
    expect(await screen.findByLabelText('Caixa subsecoes')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Lab IA' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Performance' })).toBeNull();
    expect(screen.queryByTestId('ai-debug-panel')).toBeNull();
    expect(screen.queryByTestId('ai-queue-monitor')).toBeNull();
  });
});
