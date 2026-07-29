import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

type ErrorBoundaryProps = {
  children?: ReactNode;
  onError?: (error: Error, info: { componentStack?: string }) => void;
};

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
  createHttpBillingTransport: vi.fn(() => ({})),
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
    activeTab: 'dashboard',
    setActiveTab: vi.fn(),
    renderActiveTab: () => <div data-testid="active-tab">Dashboard</div>,
  }),
}));

vi.mock('../../hooks/useSyncEngine', () => ({
  useSyncEngine: () => ({
    profile: { name: 'Ada', theme: 'light' },
    isProfileReady: true,
    hasLoadedEntities: false,
    syncStatus: 'idle',
    backendSyncEnabled: true,
    syncProfile: vi.fn(),
  }),
}));

vi.mock('../../src/app/mainNavigation', () => ({
  getActiveNavigationSection: () => ({
    id: 'cash',
    label: 'Caixa',
    defaultTab: 'dashboard',
    items: [{ tab: 'dashboard', label: 'Visao geral' }],
  }),
  getMainNavigationItems: () => [
    { tab: 'dashboard', label: 'Caixa' },
    { tab: 'history', label: 'Transacoes' },
    { tab: 'flow', label: 'Receitas' },
    { tab: 'cfo', label: 'IA' },
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

describe('App shell loading gate', () => {
  it('permite renderizar o shell quando o perfil ja carregou, mesmo com entidades ainda em bootstrap', () => {
    render(<App />);

    expect(screen.queryByText(/Iniciando Flow Financas/i)).toBeNull();
    expect(screen.getByTestId('active-tab')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Navegacao principal' })).toBeTruthy();
  });
});
