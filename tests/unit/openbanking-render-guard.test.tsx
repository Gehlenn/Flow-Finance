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
  activeWorkspacePlan: 'free',
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

  it('analytics mostra upgrade suave no plano free e tela completa no plano pro', () => {
    const { result } = renderHook(() => useNavigationTabs());

    act(() => {
      result.current.setActiveTab('analytics');
    });

    const freeOutput = result.current.renderActiveTab({ ...baseContext, activeWorkspacePlan: 'free' }) as any;
    const proOutput = result.current.renderActiveTab({ ...baseContext, activeWorkspacePlan: 'pro' }) as any;

    expect(freeOutput).not.toBeNull();
    expect(freeOutput.props?.title).toBe('Relatorios completos do caixa');
    expect(proOutput).not.toBeNull();
    expect(proOutput.type?.toString?.()).toContain('Symbol(react.suspense)');
  });

  it('propaga o plano ativo para o AICFO no tab cfo', () => {
    const { result } = renderHook(() => useNavigationTabs());

    act(() => {
      result.current.setActiveTab('cfo');
    });

    const output = result.current.renderActiveTab({ ...baseContext, activeWorkspacePlan: 'pro' }) as any;
    const child = output?.props?.children;

    expect(output).not.toBeNull();
    expect(child?.props?.workspacePlan).toBe('pro');
  });
});
