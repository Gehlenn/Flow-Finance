import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  CloudCheck,
  CloudOff,
  History,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Plus,
  Settings as SettingsIcon,
  Terminal,
  TrendingUp,
} from "lucide-react";
import { isFirebaseConfigured } from "./services/firebase";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { addBreadcrumb, initSentry } from "./src/config/sentry";
import { logError } from "./src/utils/logger";
import {
  configureBillingTransport,
  configureUsageStoreAdapter,
  createFirestoreBillingTransport,
  createFirestoreUsageStoreAdapter,
  resetUsageStoreAdapter,
} from "./src/saas";
import { useAuthAndWorkspace } from "./hooks/useAuthAndWorkspace";
import { useFinancialState } from "./hooks/useFinancialState";
import { useNavigationTabs } from "./hooks/useNavigationTabs";
import { useSyncEngine } from "./hooks/useSyncEngine";
import { getMainNavigationItems } from "./src/app/mainNavigation";

const IS_DEV = import.meta.env.DEV;
const FAB_ENABLED_TABS = new Set(["dashboard"]);
const WIDE_CONTENT_TABS = new Set(["dashboard", "history", "flow"]);
const AIInput = lazy(() => import("./components/AIInput"));
const Login = lazy(() => import("./components/Login"));
const NamePromptModal = lazy(() => import("./components/NamePromptModal"));
const AIDebugPanel = lazy(() => import("./components/dev/AIDebugPanel"));
const AITaskQueueMonitor = lazy(
  () => import("./components/dev/AITaskQueueMonitor"),
);
const Pricing = lazy(() => import("./pages/Pricing"));

if (typeof window !== "undefined") {
  initSentry();
  addBreadcrumb("App initialization", "app", "info");
}

const TabLoader: React.FC<{ label?: string }> = ({
  label = "Carregando...",
}) => (
  <div className="flex min-h-[12rem] items-center justify-center gap-3 rounded-3xl border border-slate-200/70 bg-white/70 px-6 py-10 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
    <Loader2 className="animate-spin text-indigo-600" size={20} />
    <span className="text-xs font-semibold uppercase tracking-[0.08em]">
      {label}
    </span>
  </div>
);

const App: React.FC = () => {
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const isPricingRoute = currentPath === "/pricing";

  if (isPricingRoute) {
    return (
      <Suspense fallback={<TabLoader label="Carregando pricing..." />}>
        <Pricing />
      </Suspense>
    );
  }

  const authState = useAuthAndWorkspace();
  const handleDisableCloudSync = useCallback(() => {
    authState.setCloudSyncEnabled(false);
  }, [authState.setCloudSyncEnabled]);
  const handleDisableBackendSync = useCallback(() => {
    authState.setBackendSyncEnabled(false);
  }, [authState.setBackendSyncEnabled]);
  const syncEngine = useSyncEngine({
    userId: authState.user.id,
    activeTenantId: authState.activeWorkspace.tenantId,
    activeWorkspaceId: authState.activeWorkspace.workspaceId,
    isE2EBootstrapActive: authState.isE2EBootstrapActive,
    cloudSyncEnabled: authState.cloudSyncEnabled,
    backendSyncEnabled: authState.backendSyncEnabled,
    onDisableCloudSync: handleDisableCloudSync,
    onDisableBackendSync: handleDisableBackendSync,
  });
  const financialState = useFinancialState({
    userId: authState.user.id,
    activeTenantId: authState.activeWorkspace.tenantId,
    activeWorkspaceId: authState.activeWorkspace.workspaceId,
    syncEngine,
  });
  const navigation = useNavigationTabs();
  const mainNavigationItems = useMemo(() => getMainNavigationItems(IS_DEV), []);
  const activeTabContainerClass =
    navigation.activeTab === "cfo"
      ? "max-w-4xl"
      : WIDE_CONTENT_TABS.has(navigation.activeTab)
        ? "max-w-6xl"
        : "max-w-xl";
  const showFloatingEntryButton = FAB_ENABLED_TABS.has(navigation.activeTab);
  const showDevPanels = IS_DEV && !authState.isE2EBootstrapActive;

  const [hideValues, setHideValues] = useState(false);
  const [showAIInput, setShowAIInput] = useState(false);

  const userName = syncEngine.profile.name ?? authState.user.name;
  const theme = syncEngine.profile.theme;
  const isAppLoading =
    authState.isInitialLoading ||
    (authState.isLoggedIn && !syncEngine.isProfileReady) ||
    (authState.isLoggedIn &&
      authState.backendSyncEnabled &&
      Boolean(authState.activeWorkspace.workspaceId) &&
      !syncEngine.hasLoadedEntities);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    if (authState.isE2EBootstrapActive) {
      configureBillingTransport(null);
      void resetUsageStoreAdapter();
      return;
    }

    if (
      !authState.isLoggedIn ||
      !authState.user.id ||
      !authState.activeWorkspace.workspaceId
    ) {
      configureBillingTransport(null);
      void resetUsageStoreAdapter();
      return;
    }

    if (!isFirebaseConfigured) {
      configureBillingTransport(null);
      void resetUsageStoreAdapter();
      return;
    }

    configureBillingTransport(createFirestoreBillingTransport());
    void configureUsageStoreAdapter(createFirestoreUsageStoreAdapter());

    return () => {
      configureBillingTransport(null);
      void resetUsageStoreAdapter();
    };
  }, [
    authState.activeWorkspace.workspaceId,
    authState.isE2EBootstrapActive,
    authState.isLoggedIn,
    authState.user.id,
  ]);

  const navigationContext = useMemo(
    () => ({
      userId: authState.user.id,
      userName,
      userEmail: authState.user.email,
      activeWorkspaceId: authState.activeWorkspace.workspaceId,
      activeTenantId: authState.activeWorkspace.tenantId,
      activeTenantName: authState.activeWorkspace.tenantName,
      activeWorkspaceName: authState.activeWorkspace.name,
      activeWorkspacePlan: authState.activeWorkspace.plan || "free",
      activeWorkspaceRole: authState.activeWorkspace.role,
      hideValues,
      theme,
      isDev: IS_DEV,
      transactions: financialState.transactions,
      accounts: financialState.accounts,
      alerts: financialState.alerts,
      reminders: financialState.reminders,
      receivables: financialState.receivables,
      goals: financialState.goals,
      latestLeaks: financialState.latestLeaks,
      latestReport: financialState.latestReport,
      onToggleHideValues: () => setHideValues((current) => !current),
      onNavigateToTab: navigation.setActiveTab,
      onUpdateProfileName: (name: string) => {
        authState.setUserName(name);
        void syncEngine.syncProfile({ name });
      },
      onThemeChange: (nextTheme: "light" | "dark") => {
        void syncEngine.syncProfile({ theme: nextTheme });
      },
      onLogout: authState.handleLogout,
      onOpenWorkspaceAdmin: () => navigation.setActiveTab("workspaceadmin"),
      onAddTransactions: financialState.addTransactions,
      onDeleteTransaction: financialState.deleteTransaction,
      onDeleteMultipleTransactions: financialState.deleteTransactions,
      onUpdateTransaction: financialState.updateTransaction,
      onCreateAccount: financialState.createAccount,
      onDeleteAccount: financialState.deleteAccount,
      onUpdateAccount: financialState.updateAccount,
      onCreateGoal: financialState.createGoal,
      onDeleteGoal: financialState.deleteGoal,
      onContributeGoal: financialState.contributeGoal,
      onUpdateGoal: financialState.updateGoal,
      onToggleReminder: financialState.toggleReminder,
      onDeleteReminder: financialState.deleteReminder,
      onAddReminder: financialState.addReminder,
      onUpdateReminder: financialState.updateReminder,
      onAddAlert: financialState.addAlert,
      onDeleteAlert: financialState.deleteAlert,
    }),
    [
      authState.activeWorkspace.name,
      authState.activeWorkspace.plan,
      authState.activeWorkspace.role,
      authState.activeWorkspace.tenantId,
      authState.activeWorkspace.tenantName,
      authState.activeWorkspace.workspaceId,
      authState.handleLogout,
      authState.setUserName,
      authState.user.email,
      authState.user.id,
      financialState.accounts,
      financialState.addAlert,
      financialState.addReminder,
      financialState.addTransactions,
      financialState.alerts,
      financialState.contributeGoal,
      financialState.createAccount,
      financialState.createGoal,
      financialState.deleteAccount,
      financialState.deleteAlert,
      financialState.deleteGoal,
      financialState.deleteReminder,
      financialState.deleteTransaction,
      financialState.deleteTransactions,
      financialState.goals,
      financialState.latestLeaks,
      financialState.latestReport,
      financialState.receivables,
      financialState.reminders,
      financialState.toggleReminder,
      financialState.transactions,
      financialState.updateAccount,
      financialState.updateGoal,
      financialState.updateReminder,
      financialState.updateTransaction,
      hideValues,
      navigation.setActiveTab,
      syncEngine,
      theme,
      userName,
    ],
  );

  if (isAppLoading) {
    return (
      <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
          Iniciando Flow Financas...
        </p>
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    return (
      <Suspense fallback={<TabLoader label="Carregando acesso..." />}>
        <Login
          onLogin={authState.handleLogin}
          onDevelopmentLogin={authState.handleDevelopmentLogin}
        />
      </Suspense>
    );
  }

  if (!userName) {
    return (
      <Suspense fallback={<TabLoader label="Carregando perfil..." />}>
        <NamePromptModal
          onSave={(name) => {
            authState.setUserName(name);
            void syncEngine.syncProfile({ name });
          }}
        />
      </Suspense>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logError("[App] Error caught by boundary", error, {
          errorInfo,
          fallback: "app-error-boundary-caught",
        });
      }}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 pb-24 md:pb-12 overflow-visible">
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500">
          {syncEngine.syncStatus === "syncing" && (
            <div className="flow-status-pill px-4 py-2 rounded-full flex items-center gap-2 animate-in slide-in-from-top-4">
              <Loader2 size={12} className="text-indigo-400 animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white">
                Gravando na Nuvem...
              </span>
            </div>
          )}
          {syncEngine.syncStatus === "synced" && (
            <div className="flow-status-pill bg-emerald-500/90 px-4 py-2 rounded-full flex items-center gap-2 animate-in zoom-in-95">
              <CloudCheck size={12} className="text-white" />
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white">
                Sincronizado
              </span>
            </div>
          )}
          {syncEngine.syncStatus === "error" && (
            <div className="flow-status-pill bg-rose-500/95 px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
              <CloudOff size={12} className="text-white" />
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white">
                Erro de Conexao
              </span>
            </div>
          )}
        </div>

        <div
          className={`${activeTabContainerClass} mx-auto px-4 pt-6 pb-40 md:pb-44`}
        >
          <Suspense fallback={<TabLoader label="Carregando aba..." />}>
            {navigation.renderActiveTab(navigationContext)}
          </Suspense>
        </div>
        {showFloatingEntryButton && (
          <button
            onClick={() => setShowAIInput(true)}
            aria-label="Adicionar lançamento"
            title="Adicionar lançamento"
            className="flow-fab fixed bottom-24 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-500 text-white transition-all duration-300 hover:scale-110 active:scale-90 btn-liquid md:bottom-8 md:right-8"
          >
            <Plus size={32} strokeWidth={2.5} />
          </button>
        )}

        <nav className="flow-nav fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-between px-1 py-3 md:left-1/2 md:right-auto md:bottom-6 md:w-[min(92vw,56rem)] md:-translate-x-1/2 md:justify-center md:gap-2 md:rounded-[2rem] md:border md:border-slate-200/80 md:bg-white/95 md:px-3 md:py-2 md:shadow-[0_18px_48px_-24px_rgba(15,23,42,0.35)] md:backdrop-blur dark:md:border-slate-800 dark:md:bg-slate-950/90">
          {mainNavigationItems.map((item) => (
            <NavButton
              key={item.tab}
              active={navigation.activeTab === item.tab}
              onClick={() => navigation.setActiveTab(item.tab)}
              icon={renderTabIcon(item.tab)}
              label={item.label}
            />
          ))}
        </nav>

        {showAIInput && (
          <Suspense fallback={<TabLoader label="Carregando captura..." />}>
            <AIInput
              onClose={() => setShowAIInput(false)}
              onAddTransactions={financialState.addTransactions}
              onAddReminders={financialState.addReminders}
              accounts={financialState.accounts}
              userId={authState.user.id ?? "local"}
            />
          </Suspense>
        )}

        {showDevPanels && (
          <Suspense fallback={null}>
            <AIDebugPanel />
            <AITaskQueueMonitor />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
};

const NAV_BUTTON_CLASS_MAP = {
  buttonBase:
    "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all duration-300 md:min-w-[5.5rem] md:flex-none md:px-2",
  active: "text-indigo-600 dark:text-indigo-300 -translate-y-1",
  inactive:
    "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
  iconActive:
    "flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 shadow-sm dark:bg-indigo-500/15",
  iconInactive: "flex h-10 w-10 items-center justify-center rounded-2xl",
  label:
    "max-w-[4.6rem] text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.02em] md:max-w-none md:text-xs md:tracking-[0.08em]",
};

function renderTabIcon(tab: string): React.ReactNode {
  switch (tab) {
    case "dashboard":
      return <LayoutDashboard size={18} />;
    case "history":
      return <History size={18} />;
    case "flow":
      return <TrendingUp size={18} />;
    case "cfo":
      return <MessageSquare size={18} />;
    case "insights":
      return <Activity size={18} />;
    case "settings":
      return <SettingsIcon size={18} />;
    case "aicontrol":
      return <Terminal size={18} />;
    default:
      return <LayoutDashboard size={18} />;
  }
}

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`${NAV_BUTTON_CLASS_MAP.buttonBase} ${active ? NAV_BUTTON_CLASS_MAP.active : NAV_BUTTON_CLASS_MAP.inactive}`}
  >
    <div
      className={
        active
          ? NAV_BUTTON_CLASS_MAP.iconActive
          : NAV_BUTTON_CLASS_MAP.iconInactive
      }
    >
      {icon}
    </div>
    <span className={NAV_BUTTON_CLASS_MAP.label}>{label}</span>
  </button>
);

export default App;
