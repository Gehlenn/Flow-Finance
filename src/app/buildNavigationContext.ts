import type { NavigationRenderContext } from "../../hooks/useNavigationTabs";

type WorkspacePlan = NavigationRenderContext["activeWorkspacePlan"];

export interface BuildNavigationContextArgs {
  userId: NavigationRenderContext["userId"];
  userName: NavigationRenderContext["userName"];
  userEmail: NavigationRenderContext["userEmail"];
  activeWorkspaceId: NavigationRenderContext["activeWorkspaceId"];
  activeTenantId: NavigationRenderContext["activeTenantId"];
  activeTenantName: NavigationRenderContext["activeTenantName"];
  activeWorkspaceName: NavigationRenderContext["activeWorkspaceName"];
  demoWorkspacePlan?: WorkspacePlan | null;
  workspacePlan?: WorkspacePlan | null;
  activeWorkspaceRole: NavigationRenderContext["activeWorkspaceRole"];
  hideValues: NavigationRenderContext["hideValues"];
  theme: NavigationRenderContext["theme"];
  isDev: NavigationRenderContext["isDev"];
  canAccessDevTools: NavigationRenderContext["canAccessDevTools"];
  transactions: NavigationRenderContext["transactions"];
  accounts: NavigationRenderContext["accounts"];
  alerts: NavigationRenderContext["alerts"];
  reminders: NavigationRenderContext["reminders"];
  receivables: NavigationRenderContext["receivables"];
  goals: NavigationRenderContext["goals"];
  latestLeaks?: NavigationRenderContext["latestLeaks"];
  latestReport?: NavigationRenderContext["latestReport"];
  onToggleHideValues: NavigationRenderContext["onToggleHideValues"];
  onNavigateToTab: NavigationRenderContext["onNavigateToTab"];
  onOpenEntryCapture: NonNullable<NavigationRenderContext["onOpenEntryCapture"]>;
  onUpdateProfileName: NavigationRenderContext["onUpdateProfileName"];
  onThemeChange: NavigationRenderContext["onThemeChange"];
  onLogout: NavigationRenderContext["onLogout"];
  onOpenWorkspaceAdmin: NavigationRenderContext["onOpenWorkspaceAdmin"];
  onAddTransactions: NavigationRenderContext["onAddTransactions"];
  onDeleteTransaction: NavigationRenderContext["onDeleteTransaction"];
  onDeleteMultipleTransactions: NavigationRenderContext["onDeleteMultipleTransactions"];
  onUpdateTransaction: NavigationRenderContext["onUpdateTransaction"];
  onCreateAccount: NavigationRenderContext["onCreateAccount"];
  onDeleteAccount: NavigationRenderContext["onDeleteAccount"];
  onUpdateAccount: NavigationRenderContext["onUpdateAccount"];
  onCreateGoal: NavigationRenderContext["onCreateGoal"];
  onDeleteGoal: NavigationRenderContext["onDeleteGoal"];
  onContributeGoal: NavigationRenderContext["onContributeGoal"];
  onUpdateGoal: NavigationRenderContext["onUpdateGoal"];
  onToggleReminder: NavigationRenderContext["onToggleReminder"];
  onDeleteReminder: NavigationRenderContext["onDeleteReminder"];
  onAddReminder: NavigationRenderContext["onAddReminder"];
  onUpdateReminder: NavigationRenderContext["onUpdateReminder"];
  onAddAlert: NavigationRenderContext["onAddAlert"];
  onDeleteAlert: NavigationRenderContext["onDeleteAlert"];
}

function resolveWorkspacePlan(
  demoWorkspacePlan: WorkspacePlan | null | undefined,
  workspacePlan: WorkspacePlan | null | undefined,
): WorkspacePlan {
  return demoWorkspacePlan ?? workspacePlan ?? "free";
}

export function buildNavigationContext(
  args: BuildNavigationContextArgs,
): NavigationRenderContext {
  return {
    userId: args.userId,
    userName: args.userName,
    userEmail: args.userEmail,
    activeWorkspaceId: args.activeWorkspaceId,
    activeTenantId: args.activeTenantId,
    activeTenantName: args.activeTenantName,
    activeWorkspaceName: args.activeWorkspaceName,
    activeWorkspacePlan: resolveWorkspacePlan(
      args.demoWorkspacePlan,
      args.workspacePlan,
    ),
    activeWorkspaceRole: args.activeWorkspaceRole,
    hideValues: args.hideValues,
    theme: args.theme,
    isDev: args.isDev,
    canAccessDevTools: args.canAccessDevTools,
    transactions: args.transactions,
    accounts: args.accounts,
    alerts: args.alerts,
    reminders: args.reminders,
    receivables: args.receivables,
    forceReceivablesSourceOfTruth: args.demoWorkspacePlan !== null && args.demoWorkspacePlan !== undefined,
    goals: args.goals,
    latestLeaks: args.latestLeaks,
    latestReport: args.latestReport,
    onToggleHideValues: args.onToggleHideValues,
    onNavigateToTab: args.onNavigateToTab,
    onOpenEntryCapture: args.onOpenEntryCapture,
    onUpdateProfileName: args.onUpdateProfileName,
    onThemeChange: args.onThemeChange,
    onLogout: args.onLogout,
    onOpenWorkspaceAdmin: args.onOpenWorkspaceAdmin,
    onAddTransactions: args.onAddTransactions,
    onDeleteTransaction: args.onDeleteTransaction,
    onDeleteMultipleTransactions: args.onDeleteMultipleTransactions,
    onUpdateTransaction: args.onUpdateTransaction,
    onCreateAccount: args.onCreateAccount,
    onDeleteAccount: args.onDeleteAccount,
    onUpdateAccount: args.onUpdateAccount,
    onCreateGoal: args.onCreateGoal,
    onDeleteGoal: args.onDeleteGoal,
    onContributeGoal: args.onContributeGoal,
    onUpdateGoal: args.onUpdateGoal,
    onToggleReminder: args.onToggleReminder,
    onDeleteReminder: args.onDeleteReminder,
    onAddReminder: args.onAddReminder,
    onUpdateReminder: args.onUpdateReminder,
    onAddAlert: args.onAddAlert,
    onDeleteAlert: args.onDeleteAlert,
  };
}
