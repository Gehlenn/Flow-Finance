import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import {
  AppFab,
  AppMainNav,
  AppSubNav,
  AppTopStatus,
} from "./components/app-shell";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { addBreadcrumb, initSentry } from "./src/config/sentry";
import { logError } from "./src/utils/logger";
import {
  configureBillingTransport,
  configureUsageStoreAdapter,
  createHttpBillingTransport,
  createHttpUsageStoreAdapter,
  resetUsageStoreAdapter,
} from "./src/saas";
import { useAuthAndWorkspace } from "./hooks/useAuthAndWorkspace";
import { useFinancialState } from "./hooks/useFinancialState";
import { useNavigationTabs } from "./hooks/useNavigationTabs";
import { useSyncEngine } from "./hooks/useSyncEngine";
import { canAccessDeveloperTools } from "./src/app/developerAccess";
import {
  getActiveNavigationSection,
  getMainNavigationItems,
} from "./src/app/mainNavigation";
import { buildNavigationContext } from "./src/app/buildNavigationContext";
import {
  getActiveTabContainerClass,
  getShellContentSpacingClass,
  shouldShowFloatingEntryButton,
  shouldShowTopStatus,
} from "./src/app/appShellLayout";
import { trackProductEvent, trackProductEventOnce } from "./src/app/productAnalytics";
import { getDemoBootstrapPlan } from "./src/demo/demoBootstrap";
import { useAppTheme } from "./src/app/useAppTheme";
import { useBillingRuntime } from "./src/app/useBillingRuntime";
import { useSyncErrorTracking } from "./src/app/useSyncErrorTracking";
import { canViewWorkspaceAudit } from "./src/security/workspacePermissions";

const IS_DEV = import.meta.env.DEV;
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
    isDemoBootstrapActive: authState.isDemoBootstrapActive,
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
    isDemoMode: authState.isDemoBootstrapActive,
  });
  const navigation = useNavigationTabs();
  const canAccessDevTools = canAccessDeveloperTools({
    isDevMode: IS_DEV,
    email: authState.user.email,
  });
  const canAccessWorkspaceAdmin = canViewWorkspaceAudit(
    authState.activeWorkspace.role,
  );
  const navigationAccess = useMemo(
    () => ({
      canAccessDevTools,
      canAccessWorkspaceAdmin,
    }),
    [canAccessDevTools, canAccessWorkspaceAdmin],
  );
  const mainNavigationItems = useMemo(
    () => getMainNavigationItems(navigationAccess),
    [navigationAccess],
  );
  const activeNavigationSection = useMemo(
    () => getActiveNavigationSection(navigation.activeTab, navigationAccess),
    [navigation.activeTab, navigationAccess],
  );
  const showTopStatus = shouldShowTopStatus({
    isDemoBootstrapActive: authState.isDemoBootstrapActive,
    syncStatus: syncEngine.syncStatus,
  });
  const activeTabContainerClass = getActiveTabContainerClass(
    navigation.activeTab,
  );
  const showFloatingEntryButton = shouldShowFloatingEntryButton(
    navigation.activeTab,
  );
  const showDevPanels =
    canAccessDevTools &&
    !authState.isE2EBootstrapActive &&
    !authState.isDemoBootstrapActive;
  const demoWorkspacePlan = getDemoBootstrapPlan();

  const [hideValues, setHideValues] = useState(false);
  const [showAIInput, setShowAIInput] = useState(false);

  const userName = syncEngine.profile.name ?? authState.user.name;
  const hasTrackedReturnVisitRef = useRef(false);
  const theme = syncEngine.profile.theme;
  useAppTheme({
    theme,
    documentElement:
      typeof document !== "undefined" ? document.documentElement : null,
  });
  useEffect(() => {
    if (
      authState.isInitialLoading
      || !authState.isLoggedIn
      || authState.isDemoBootstrapActive
      || authState.isE2EBootstrapActive
      || hasTrackedReturnVisitRef.current
    ) {
      return;
    }

    hasTrackedReturnVisitRef.current = true;

    let daysSinceLastVisit: number | null = null;
    if (typeof window !== "undefined") {
      const storageKey = "flow:return_visit:last_seen";
      try {
        const lastSeen = window.localStorage.getItem(storageKey);
        if (lastSeen) {
          const parsedLastSeen = new Date(lastSeen);
          if (!Number.isNaN(parsedLastSeen.getTime())) {
            const diffMs = Date.now() - parsedLastSeen.getTime();
            daysSinceLastVisit = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
          }
        }

        window.localStorage.setItem(storageKey, new Date().toISOString());
      } catch {
        daysSinceLastVisit = null;
      }
    }

    trackProductEvent("return_visit", {
      source: "app_shell",
      plan: authState.activeWorkspace.plan || "free",
      has_workspace: Boolean(authState.activeWorkspace.workspaceId),
      days_since_last_visit: daysSinceLastVisit,
    });
  }, [
    authState.activeWorkspace.plan,
    authState.activeWorkspace.workspaceId,
    authState.isDemoBootstrapActive,
    authState.isE2EBootstrapActive,
    authState.isInitialLoading,
    authState.isLoggedIn,
  ]);

  useEffect(() => {
    if (
      authState.isInitialLoading
      || !authState.isLoggedIn
      || authState.isDemoBootstrapActive
      || authState.isE2EBootstrapActive
      || userName
    ) {
      return;
    }

    trackProductEventOnce(
      "onboarding_started",
      authState.activeWorkspace.workspaceId || authState.user.id || "local",
      {
        source: "app_shell",
        plan: authState.activeWorkspace.plan || "free",
        has_workspace: Boolean(authState.activeWorkspace.workspaceId),
        has_profile_name: Boolean(userName),
        entry_point: "name_prompt",
      },
    );
  }, [
    authState.activeWorkspace.plan,
    authState.activeWorkspace.workspaceId,
    authState.isDemoBootstrapActive,
    authState.isE2EBootstrapActive,
    authState.isInitialLoading,
    authState.isLoggedIn,
    authState.user.id,
    userName,
  ]);

  useSyncErrorTracking({
    syncStatus: syncEngine.syncStatus,
    activeTab: navigation.activeTab,
    plan: authState.activeWorkspace.plan || "free",
    trackEvent: trackProductEvent,
  });
  useBillingRuntime({
    isDemoBootstrapActive: authState.isDemoBootstrapActive,
    isE2EBootstrapActive: authState.isE2EBootstrapActive,
    isLoggedIn: authState.isLoggedIn,
    userId: authState.user.id,
    workspaceId: authState.activeWorkspace.workspaceId,
    configureBillingTransport,
    configureUsageStoreAdapter,
    resetUsageStoreAdapter,
    createBillingTransport: createHttpBillingTransport,
    createUsageStoreAdapter: createHttpUsageStoreAdapter,
  });
  const handleOpenEntryCapture = useCallback(() => {
    setShowAIInput(true);
  }, []);
  const handleOpenWorkspaceAdmin = useCallback(() => {
    navigation.setActiveTab("workspaceadmin");
  }, [navigation.setActiveTab]);

  const isAppLoading =
    authState.isInitialLoading ||
    (authState.isLoggedIn && !syncEngine.isProfileReady);

  const navigationContext = useMemo(() => {
    return buildNavigationContext({
      userId: authState.user.id,
      userName,
      userEmail: authState.user.email,
      activeWorkspaceId: authState.activeWorkspace.workspaceId,
      activeTenantId: authState.activeWorkspace.tenantId,
      activeTenantName: authState.activeWorkspace.tenantName,
      activeWorkspaceName: authState.activeWorkspace.name,
      demoWorkspacePlan,
      workspacePlan: authState.activeWorkspace.plan,
      activeWorkspaceRole: authState.activeWorkspace.role,
      hideValues,
      theme,
      isDev: IS_DEV,
      canAccessDevTools,
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
      onOpenEntryCapture: handleOpenEntryCapture,
      onUpdateProfileName: (name: string) => {
        authState.setUserName(name);
        void syncEngine.syncProfile({ name });
      },
      onThemeChange: (nextTheme: "light" | "dark") => {
        void syncEngine.syncProfile({ theme: nextTheme });
      },
      onLogout: authState.handleLogout,
      onOpenWorkspaceAdmin: handleOpenWorkspaceAdmin,
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
    });
  }, [
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
    demoWorkspacePlan,
    hideValues,
    canAccessDevTools,
    handleOpenEntryCapture,
    handleOpenWorkspaceAdmin,
    navigation.setActiveTab,
    syncEngine,
    theme,
    userName,
  ]);

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
      <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 pb-0 md:pb-12 overflow-visible">
        <AppTopStatus
          showTopStatus={showTopStatus}
          isDemoBootstrapActive={authState.isDemoBootstrapActive}
          syncStatus={syncEngine.syncStatus}
        />

        <div
          className={`${activeTabContainerClass} mx-auto px-4 ${getShellContentSpacingClass(showTopStatus)} pb-10 md:pb-12`}
        >
          <AppMainNav
            items={mainNavigationItems}
            activeSectionTab={activeNavigationSection.defaultTab}
            onSelectTab={navigation.setActiveTab}
          />

          <AppSubNav
            label={activeNavigationSection.label}
            items={activeNavigationSection.items}
            activeTab={navigation.activeTab}
            onSelectTab={navigation.setActiveTab}
          />
          <Suspense fallback={<TabLoader label="Carregando aba..." />}>
            {navigation.renderActiveTab(navigationContext)}
          </Suspense>
        </div>
        <AppFab
          visible={showFloatingEntryButton}
          onClick={() => setShowAIInput(true)}
        />

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

export default App;
