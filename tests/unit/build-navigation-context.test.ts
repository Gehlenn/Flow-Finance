import { describe, expect, it, vi } from 'vitest';
import { buildNavigationContext } from '../../src/app/buildNavigationContext';

describe('buildNavigationContext', () => {
  it('prioriza demo plan, depois workspace plan e por fim free', () => {
    const base = {
      userId: 'user-1',
      userName: 'Ada',
      userEmail: 'ada@flow.test',
      activeWorkspaceId: 'workspace-1',
      activeTenantId: 'tenant-1',
      activeTenantName: 'Tenant',
      activeWorkspaceName: 'Workspace',
      activeWorkspaceRole: 'owner' as const,
      hideValues: false,
      theme: 'light' as const,
      isDev: false,
      canAccessDevTools: false,
      transactions: [],
      accounts: [],
      alerts: [],
      reminders: [],
      receivables: [],
      goals: [],
      onToggleHideValues: vi.fn(),
      onNavigateToTab: vi.fn(),
      onOpenEntryCapture: vi.fn(),
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

    expect(
      buildNavigationContext({
        ...base,
        demoWorkspacePlan: 'pro',
        workspacePlan: 'free',
      }).activeWorkspacePlan,
    ).toBe('pro');

    expect(
      buildNavigationContext({
        ...base,
        demoWorkspacePlan: null,
        workspacePlan: 'pro',
      }).activeWorkspacePlan,
    ).toBe('pro');

    expect(
      buildNavigationContext({
        ...base,
        demoWorkspacePlan: null,
        workspacePlan: null,
      }).activeWorkspacePlan,
    ).toBe('free');
  });

  it('repassa callbacks e dados sem trocar referencias', () => {
    const onOpenEntryCapture = vi.fn();
    const onOpenWorkspaceAdmin = vi.fn();
    const onAddTransactions = vi.fn();

    const transactions = [{ id: 't-1' }];
    const accounts = [{ id: 'a-1' }];
    const alerts = [{ id: 'al-1' }];
    const reminders = [{ id: 'r-1' }];
    const receivables = [{ id: 'rc-1' }];
    const goals = [{ id: 'g-1' }];

    const result = buildNavigationContext({
      userId: 'user-1',
      userName: 'Ada',
      userEmail: 'ada@flow.test',
      activeWorkspaceId: 'workspace-1',
      activeTenantId: 'tenant-1',
      activeTenantName: 'Tenant',
      activeWorkspaceName: 'Workspace',
      demoWorkspacePlan: null,
      workspacePlan: 'pro',
      activeWorkspaceRole: 'owner',
      hideValues: true,
      theme: 'dark',
      isDev: true,
      canAccessDevTools: true,
      transactions,
      accounts,
      alerts,
      reminders,
      receivables,
      goals,
      latestLeaks: [{ id: 'l-1' }] as never,
      latestReport: { id: 'report-1' } as never,
      onToggleHideValues: vi.fn(),
      onNavigateToTab: vi.fn(),
      onOpenEntryCapture,
      onUpdateProfileName: vi.fn(),
      onThemeChange: vi.fn(),
      onLogout: vi.fn(),
      onOpenWorkspaceAdmin,
      onAddTransactions,
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
    });

    expect(result.onOpenEntryCapture).toBe(onOpenEntryCapture);
    expect(result.onOpenWorkspaceAdmin).toBe(onOpenWorkspaceAdmin);
    expect(result.onAddTransactions).toBe(onAddTransactions);
    expect(result.transactions).toBe(transactions);
    expect(result.accounts).toBe(accounts);
    expect(result.alerts).toBe(alerts);
    expect(result.reminders).toBe(reminders);
    expect(result.receivables).toBe(receivables);
    expect(result.goals).toBe(goals);
    expect(result.activeWorkspacePlan).toBe('pro');
  });
});
