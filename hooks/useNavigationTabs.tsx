import React, { Suspense, lazy, useCallback, useState } from 'react';
import { Loader2, Activity } from 'lucide-react';
import { Account } from '../models/Account';
import { Alert, Goal, Reminder, Transaction } from '../types';
import type { WorkspaceRole } from '../src/services/workspaceSession';
import { canAccessFeature } from '../src/app/monetizationPlan';
import UpgradePromptCard from '../components/UpgradePromptCard';

const lazyWithRetry = (importFn: () => Promise<any>) => {
  return lazy(() =>
    importFn().catch((error) => {
      console.error('[Navigation] Failed to load module, retrying...', error);
      return new Promise((resolve) => setTimeout(resolve, 1000))
        .then(() => importFn())
        .catch((retryError) => {
          console.error('[Navigation] Module load failed after retry', retryError);
        });
    }),
  );
};

const Dashboard = lazyWithRetry(() => import('../components/Dashboard'));
const Assistant = lazyWithRetry(() => import('../components/Assistant'));
const CashFlow = lazyWithRetry(() => import('../components/CashFlow'));
const TransactionList = lazyWithRetry(() => import('../components/TransactionList'));
const Settings = lazyWithRetry(() => import('../components/Settings'));
const WorkspaceAdminPage = lazyWithRetry(() => import('../pages/WorkspaceAdmin'));
const WorkspaceAuditPage = lazyWithRetry(() => import('../pages/WorkspaceAudit'));
const PerformanceMonitor = lazyWithRetry(() => import('../components/PerformanceMonitor'));
const AdvancedAnalytics = lazyWithRetry(() => import('../components/AdvancedAnalytics'));
const AccountsPage = lazyWithRetry(() => import('../pages/Accounts'));
const InsightsPage = lazyWithRetry(() => import('../pages/Insights'));
const AICFOPage = lazyWithRetry(() => import('../pages/AICFO'));
const AutopilotPage = lazyWithRetry(() => import('../pages/Autopilot'));
const GoalsPage = lazyWithRetry(() => import('../pages/Goals'));
const ReceiptScannerPage = lazyWithRetry(() => import('../pages/ReceiptScanner'));
const ImportTransactionsPage = lazyWithRetry(() => import('../pages/ImportTransactions'));
const OpenBankingPage = lazyWithRetry(() => import('../pages/OpenBanking'));
const AIControlPanel = lazyWithRetry(() => import('../pages/AIControlPanel'));

export type Tab =
  | 'dashboard'
  | 'history'
  | 'assistant'
  | 'flow'
  | 'settings'
  | 'workspaceadmin'
  | 'workspaceaudit'
  | 'accounts'
  | 'insights'
  | 'cfo'
  | 'autopilot'
  | 'goals'
  | 'scanner'
  | 'import'
  | 'openbanking'
  | 'aicontrol'
  | 'analytics'
  | 'performance';

export interface NavigationRenderContext {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  activeWorkspaceId: string | null;
  activeTenantId?: string | null;
  activeTenantName?: string | null;
  activeWorkspaceName: string | null;
  activeWorkspacePlan: 'free' | 'pro';
  activeWorkspaceRole?: WorkspaceRole | null;
  hideValues: boolean;
  theme: 'light' | 'dark';
  isDev: boolean;
  transactions: Transaction[];
  accounts: Account[];
  alerts: Alert[];
  reminders: Reminder[];
  goals: Goal[];
  onToggleHideValues: () => void;
  onNavigateToTab: (tab: Tab) => void;
  onUpdateProfileName: (name: string) => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onLogout: () => void | Promise<void>;
  onOpenWorkspaceAdmin: () => void;
  onAddTransactions: (transactions: Partial<Transaction>[]) => void | Promise<void>;
  onDeleteTransaction: (transactionId: string) => void | Promise<void>;
  onDeleteMultipleTransactions: (transactionIds: string[]) => void | Promise<void>;
  onUpdateTransaction: (transaction: Transaction) => void | Promise<void>;
  onCreateAccount: (account: { name: string; type: Account['type']; balance: number }) => void | Promise<void>;
  onDeleteAccount: (accountId: string) => void | Promise<void>;
  onUpdateAccount: (account: Account) => void | Promise<void>;
  onCreateGoal: (goal: Omit<Goal, 'id'>) => void | Promise<void>;
  onDeleteGoal: (goalId: string) => void | Promise<void>;
  onContributeGoal: (goalId: string, amount: number) => void | Promise<void>;
  onUpdateGoal: (goal: Goal) => void | Promise<void>;
  onToggleReminder: (reminderId: string) => void | Promise<void>;
  onDeleteReminder: (reminderId: string) => void | Promise<void>;
  onAddReminder: (reminder: Partial<Reminder>) => void | Promise<void>;
  onUpdateReminder: (reminder: Reminder) => void | Promise<void>;
  onAddAlert: (alert: Omit<Alert, 'id'>) => void | Promise<void>;
  onDeleteAlert: (alertId: string) => void | Promise<void>;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="animate-spin" size={24} />
    </div>
  );
}

export function useNavigationTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const renderActiveTab = useCallback((context: NavigationRenderContext) => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard
              userName={context.userName}
              userEmail={context.userEmail}
              userId={context.userId}
              activeWorkspaceName={context.activeWorkspaceName}
              activeWorkspacePlan={context.activeWorkspacePlan}
              transactions={context.transactions}
              accounts={context.accounts}
              alerts={context.alerts}
              reminders={context.reminders}
              hideValues={context.hideValues}
              onNavigateToInsights={() => context.onNavigateToTab('insights')}
              onNavigateToAccounts={() => context.onNavigateToTab('accounts')}
              onNavigateToHistory={() => context.onNavigateToTab('history')}
              onNavigateToFlow={() => context.onNavigateToTab('flow')}
            />
          </Suspense>
        );
      case 'assistant':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Assistant
              reminders={context.reminders}
              alerts={context.alerts}
              goals={context.goals}
              transactions={context.transactions}
              workspacePlan={context.activeWorkspacePlan}
              hideValues={context.hideValues}
              onToggleComplete={context.onToggleReminder}
              onDeleteReminder={context.onDeleteReminder}
              onAddReminder={context.onAddReminder}
              onUpdateReminder={context.onUpdateReminder}
              onSaveAlert={context.onAddAlert}
              onDeleteAlert={context.onDeleteAlert}
              onSaveGoal={context.onCreateGoal}
              onDeleteGoal={context.onDeleteGoal}
              onUpdateGoal={context.onUpdateGoal}
            />
          </Suspense>
        );
      case 'analytics':
        if (!canAccessFeature(context.activeWorkspacePlan, 'advancedReports')) {
          return (
            <UpgradePromptCard
              title="Relatorios completos do caixa"
              description="O Free continua com leitura principal no dashboard. No Pro, voce abre uma camada analitica mais profunda."
              bullets={[
                'comparativos historicos mais completos',
                'projecoes e tendencia de caixa com mais profundidade',
                'visualizacoes avancadas para decisao operacional',
              ]}
            />
          );
        }

        return (
          <Suspense fallback={<LoadingFallback />}>
            <AdvancedAnalytics
              activeWorkspaceName={context.activeWorkspaceName}
              transactions={context.transactions}
              hideValues={context.hideValues}
            />
          </Suspense>
        );
      case 'flow':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <CashFlow
              activeWorkspaceId={context.activeWorkspaceId}
              activeWorkspaceName={context.activeWorkspaceName}
              transactions={context.transactions}
              hideValues={context.hideValues}
              theme={context.theme}
            />
          </Suspense>
        );
      case 'history':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <TransactionList
              activeWorkspaceId={context.activeWorkspaceId}
              activeWorkspaceName={context.activeWorkspaceName}
              transactions={context.transactions}
              hideValues={context.hideValues}
              canEdit={context.activeWorkspaceRole !== 'viewer'}
              onDelete={context.onDeleteTransaction}
              onDeleteMultiple={context.onDeleteMultipleTransactions}
              onUpdate={context.onUpdateTransaction}
            />
          </Suspense>
        );
      case 'autopilot':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AutopilotPage
              transactions={context.transactions}
              accounts={context.accounts}
              userId={context.userId ?? 'local'}
              workspacePlan={context.activeWorkspacePlan}
              hideValues={context.hideValues}
            />
          </Suspense>
        );
      case 'cfo':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AICFOPage
              transactions={context.transactions}
              accounts={context.accounts}
              userId={context.userId ?? 'local'}
              workspacePlan={context.activeWorkspacePlan}
              hideValues={context.hideValues}
            />
          </Suspense>
        );
      case 'insights':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <InsightsPage
              activeWorkspaceName={context.activeWorkspaceName}
              transactions={context.transactions}
              userId={context.userId ?? 'local'}
              workspacePlan={context.activeWorkspacePlan}
              hideValues={context.hideValues}
            />
          </Suspense>
        );
      case 'goals':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <GoalsPage
              hideValues={context.hideValues}
              goals={context.goals}
              canEditGoals={context.activeWorkspaceRole !== 'viewer'}
              onCreateGoal={context.onCreateGoal}
              onDeleteGoal={context.onDeleteGoal}
              onContributeGoal={context.onContributeGoal}
            />
          </Suspense>
        );
      case 'scanner':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ReceiptScannerPage
              hideValues={context.hideValues}
              onAddTransaction={context.onAddTransactions}
            />
          </Suspense>
        );
      case 'import':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ImportTransactionsPage
              transactions={context.transactions}
              userId={context.userId ?? 'local'}
              hideValues={context.hideValues}
              onAddTransactions={context.onAddTransactions}
            />
          </Suspense>
        );
      case 'openbanking':
        return context.isDev ? (
          <Suspense fallback={<LoadingFallback />}>
            <OpenBankingPage
              userId={context.userId ?? 'local'}
              transactions={context.transactions}
              accounts={context.accounts}
              hideValues={context.hideValues}
              onNewTransactions={context.onAddTransactions}
              onUpdateAccount={context.onUpdateAccount}
            />
          </Suspense>
        ) : null;
      case 'aicontrol':
        return context.isDev ? (
          <Suspense fallback={<LoadingFallback />}>
            <AIControlPanel
              transactions={context.transactions}
              accounts={context.accounts}
              userId={context.userId ?? 'local'}
            />
          </Suspense>
        ) : null;
      case 'accounts':
        return context.userId ? (
          <Suspense fallback={<LoadingFallback />}>
            <AccountsPage
              userId={context.userId}
              hideValues={context.hideValues}
              activeWorkspaceName={context.activeWorkspaceName}
              activeWorkspaceRole={context.activeWorkspaceRole}
              activeTenantName={context.activeTenantName}
              accounts={context.accounts}
              onCreateAccount={context.onCreateAccount}
              onDeleteAccount={context.onDeleteAccount}
            />
          </Suspense>
        ) : null;
      case 'settings':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Settings
              userName={context.userName}
              userEmail={context.userEmail}
              theme={context.theme}
              activeWorkspaceRole={context.activeWorkspaceRole}
              activeWorkspaceName={context.activeWorkspaceName}
              activeTenantName={context.activeTenantName}
              onUpdateProfile={context.onUpdateProfileName}
              onLogout={context.onLogout}
              onThemeChange={context.onThemeChange}
              onOpenWorkspaceAdmin={context.onOpenWorkspaceAdmin}
            />
          </Suspense>
        );
      case 'workspaceadmin':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <WorkspaceAdminPage
              userId={context.userId}
              activeWorkspaceId={context.activeWorkspaceId}
              activeWorkspaceName={context.activeWorkspaceName}
              activeTenantName={context.activeTenantName}
              activeWorkspaceRole={context.activeWorkspaceRole}
              onNavigateToTab={context.onNavigateToTab}
            />
          </Suspense>
        );
      case 'workspaceaudit':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <WorkspaceAuditPage
              userId={context.userId}
              activeWorkspaceId={context.activeWorkspaceId}
              activeWorkspaceName={context.activeWorkspaceName}
              activeTenantName={context.activeTenantName}
              activeWorkspaceRole={context.activeWorkspaceRole}
              onNavigateToTab={context.onNavigateToTab}
            />
          </Suspense>
        );
      case 'performance':
        return (
          <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-24 overflow-visible">
            <div className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-amber-500/20 shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-2xl font-black text-white tracking-tight leading-none">Performance</h2>
                <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Monitoramento em Tempo Real</p>
              </div>
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
                <Activity size={20} />
              </div>
            </div>
            <PerformanceMonitor />
          </div>
        );
      default:
        return null;
    }
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab,
    renderActiveTab,
  };
}
