import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNavigationTabs, type NavigationRenderContext } from '../../hooks/useNavigationTabs';

const baseContext: NavigationRenderContext = {
  userId: 'u1',
  userName: 'Teste',
  userEmail: 'teste@flow.com',
  activeWorkspaceId: 'ws1',
  activeTenantId: 't1',
  activeTenantName: null,
  activeWorkspaceName: 'Workspace Teste',
  activeWorkspaceRole: null,
  hideValues: false,
  theme: 'light',
  isDev: false,
  transactions: [],
  accounts: [],
  alerts: [],
  reminders: [],
  goals: [],
  onToggleHideValues: vi.fn(),
  onNavigateToTab: vi.fn(),
  onUpdateProfileName: vi.fn(),
  onThemeChange: vi.fn(),
  onLogout: vi.fn(),
  onOpenWorkspaceAdmin: vi.fn(),
  onAddTransactions: vi.fn(),
  onDeleteTransaction: vi.fn(),
  onDeleteMultipleTransactions: vi.fn(),
  onUpdateTransaction: vi.fn(),
  onCreateAccount: vi.fn(),
  onDeleteAccount: vi.fn(),
  onUpdateAccount: vi.fn(),
  onCreateGoal: vi.fn(),
  onDeleteGoal: vi.fn(),
  onContributeGoal: vi.fn(),
  onUpdateGoal: vi.fn(),
  onToggleReminder: vi.fn(),
  onDeleteReminder: vi.fn(),
  onAddReminder: vi.fn(),
  onUpdateReminder: vi.fn(),
  onAddAlert: vi.fn(),
  onDeleteAlert: vi.fn(),
};

describe('guard de render do openbanking', () => {
  it('renderActiveTab retorna null para openbanking quando isDev e false', () => {
    const { result } = renderHook(() => useNavigationTabs());

    act(() => {
      result.current.setActiveTab('openbanking');
    });

    const output = result.current.renderActiveTab({ ...baseContext, isDev: false });

    expect(output).toBeNull();
  });

  it('renderActiveTab retorna elemento para openbanking quando isDev e true', () => {
    const { result } = renderHook(() => useNavigationTabs());

    act(() => {
      result.current.setActiveTab('openbanking');
    });

    const output = result.current.renderActiveTab({ ...baseContext, isDev: true });

    expect(output).not.toBeNull();
  });

  it('aicontrol tambem retorna null quando isDev e false', () => {
    const { result } = renderHook(() => useNavigationTabs());

    act(() => {
      result.current.setActiveTab('aicontrol');
    });

    const output = result.current.renderActiveTab({ ...baseContext, isDev: false });

    expect(output).toBeNull();
  });
});
