import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

type ErrorBoundaryProps = {
  children?: ReactNode;
  onError?: (error: Error, info: { componentStack?: string }) => void;
};

const appShellMocks = vi.hoisted(() => ({
  setActiveTabMock: vi.fn(),
  renderActiveTabMock: vi.fn(() => <div data-testid="active-tab">Shell tab</div>),
}));

vi.mock('../../src/utils/logger', () => ({
  logError: vi.fn(),
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
  createFirestoreUsageStoreAdapter: vi.fn(() => ({})),
  createHttpBillingTransport: vi.fn(() => ({})),
  createHttpUsageStoreAdapter: vi.fn(() => ({})),
  resetUsageStoreAdapter: vi.fn(),
}));

vi.mock('../../hooks/useAuthAndWorkspace', () => ({
  useAuthAndWorkspace: () => ({
    user: { id: 'user-1', name: 'Ada', email: 'ada@flow.test' },
    activeWorkspace: {
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      tenantName: 'Tenant',
      name: 'Workspace',
      plan: 'free',
      role: 'owner',
    },
    isE2EBootstrapActive: false,
    isDemoBootstrapActive: true,
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
    activeTab: 'cfo',
    setActiveTab: appShellMocks.setActiveTabMock,
    renderActiveTab: appShellMocks.renderActiveTabMock,
  }),
}));

vi.mock('../../hooks/useSyncEngine', () => ({
  useSyncEngine: () => ({
    profile: { name: 'Ada', theme: 'light' },
    isProfileReady: true,
    hasLoadedEntities: true,
    syncStatus: 'synced',
    syncProfile: vi.fn(),
  }),
}));

vi.mock('../../src/app/mainNavigation', () => ({
  getActiveNavigationSection: () => ({
    id: 'ai',
    label: 'IA',
    defaultTab: 'cfo',
    items: [
      { tab: 'cfo', label: 'Consultor de caixa' },
      { tab: 'assistant', label: 'Plano de acao' },
    ],
  }),
  getMainNavigationItems: () => [
    { tab: 'dashboard', label: 'Caixa' },
    { tab: 'history', label: 'Transacoes' },
    { tab: 'flow', label: 'Receitas' },
    { tab: 'cfo', label: 'IA' },
  ],
}));

vi.mock('../../src/demo/demoBootstrap', () => ({
  getDemoBootstrapPlan: () => null,
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

describe('App shell demo status spacing', () => {
  it('aumenta o respiro superior quando o badge Demo Pro aparece no mobile', () => {
    const { container } = render(<App />);

    expect(screen.getByText(/Demo Pro/i)).toBeTruthy();

    const contentWrapper = container.querySelector('div.max-w-4xl');
    expect(contentWrapper?.className).toContain('pt-12 md:pt-16');
  });
});
