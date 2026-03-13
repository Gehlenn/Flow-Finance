import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Transaction, TransactionType, Category, Alert, Reminder, Goal } from './types';
import { Account } from './models/Account';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initSentry, setUser, clearUser, addBreadcrumb } from './src/config/sentry';
import Dashboard from './components/Dashboard';
import AIInput from './components/AIInput';
import TransactionList from './components/TransactionList';
import OpenFinance from './components/OpenFinance';
import Assistant from './components/Assistant';
import CashFlow from './components/CashFlow';
import Login from './components/Login';
import NamePromptModal from './components/NamePromptModal';
import Settings from './components/Settings';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import PerformanceMonitor from './components/PerformanceMonitor';
import AIDebugPanel from './components/dev/AIDebugPanel';
import AITaskQueueMonitor from './components/dev/AITaskQueueMonitor';
import { detectAndLearnPatterns } from './src/ai/aiMemory';
import { runAdaptiveLearning } from './src/ai/adaptiveAIEngine';
import { FinancialEventEmitter, initEventListeners } from './src/events/eventEngine';
import {
  LayoutDashboard, History, TrendingUp,
  Settings as SettingsIcon, BrainCircuit, Plus, Download, Building2, Terminal,
  CloudCheck, CloudOff, Loader2, Landmark, Sparkles, MessageSquare, Zap, BarChart3, Activity
} from 'lucide-react';

// Lazy load page components for better performance
// Dynamic import with failsafe fallback to prevent app crash
const lazyWithRetry = (importFn: () => Promise<any>) => {
  return lazy(() =>
    importFn().catch((error) => {
      console.error('[App] Failed to load module, retrying...', error);
      // Retry after 1s (handles transient network issues)
      return new Promise((resolve) => setTimeout(resolve, 1000))
        .then(() => importFn())
        .catch((retryError) => {
          console.error('[App] Module load failed after retry', retryError);
          // Force page reload as last resort
          window.location.reload();
          // Return empty component to prevent render crash
          return { default: () => null };
        });
    })
  );
};

const AccountsPage = lazyWithRetry(() => import('./pages/Accounts'));
const InsightsPage = lazyWithRetry(() => import('./pages/Insights'));
const AICFOPage = lazyWithRetry(() => import('./pages/AICFO'));
const AutopilotPage = lazyWithRetry(() => import('./pages/Autopilot'));
const GoalsPage = lazyWithRetry(() => import('./pages/Goals'));
const ReceiptScannerPage = lazyWithRetry(() => import('./pages/ReceiptScanner'));
const ImportTransactionsPage = lazyWithRetry(() => import('./pages/ImportTransactions'));
const OpenBankingPage = lazyWithRetry(() => import('./pages/OpenBanking'));
const AIControlPanel = lazyWithRetry(() => import('./pages/AIControlPanel'));

// Firebase Services centralizados (produção)
import { auth, db, onAuthStateChanged } from './services/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAccounts, createAccount, updateAccount } from './services/firebaseOptimized';
import { API_ENDPOINTS } from './src/config/api.config';
import { isSyncPermissionError, shouldDisplaySyncConnectionError } from './src/utils/syncError';

type Tab = 'dashboard' | 'history' | 'assistant' | 'flow' | 'settings' | 'accounts' | 'insights' | 'cfo' | 'autopilot' | 'goals' | 'scanner' | 'import' | 'openbanking' | 'aicontrol' | 'analytics' | 'performance';

const IS_DEV = import.meta.env.DEV;

// ─── Platform Detection ───────────────────────────────────────────────────────

const isPlatformNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.Capacitor?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
};

const getPlatform = (): 'web' | 'android' | 'ios' => {
  if (typeof window === 'undefined') return 'web';
  try {
    if (!window.Capacitor?.isNativePlatform?.()) return 'web';
    const platform = window.Capacitor.getPlatform?.();
    return (platform as 'android' | 'ios') ?? 'web';
  } catch {
    return 'web';
  }
};

// ─── SENTRY INITIALIZATION ────────────────────────────────────────────────────

// Initialize Sentry for error tracking (must be called before React renders)
if (typeof window !== 'undefined') {
  initSentry();
  addBreadcrumb('App initialization', 'app', 'info');
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hideValues, setHideValues] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showAIInput, setShowAIInput] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // PART 9 — Aprender padrões automaticamente quando transações mudam
  useEffect(() => {
    if (userId && transactions.length >= 3) {
      detectAndLearnPatterns(userId, transactions);
      // PART 8 — Executar engine adaptativo em background
      runAdaptiveLearning(userId, transactions).catch((e) => {
        console.error('Falha ao executar aprendizado adaptativo:', e);
      });
    }
  }, [userId, transactions.length]);

  // PART 4 — Inicializar event pipeline reativo (uma vez por sessão)
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = initEventListeners(() => ({
      transactions,
      accounts,
      userId: userId ?? 'local',
    }));
    return unsubscribe;
  }, [userId, transactions, accounts]);

  // Carregar contas do usuário e criar conta padrão se necessário
  useEffect(() => {
    if (!userId) return;
    const loadAccounts = async () => {
      const data = await getAccounts(userId);
      if (data.length === 0) {
        const defaultAcc: Account = {
          id: Math.random().toString(36).substr(2, 9),
          user_id: userId,
          name: 'Carteira',
          type: 'cash',
          balance: 0,
          currency: 'BRL',
          created_at: new Date().toISOString(),
        };
        await createAccount(defaultAcc);
        setAccounts([defaultAcc]);
      } else {
        setAccounts(data);
      }
    };
    loadAccounts();
  }, [userId]);

  // 1. Escutar Mudanças na Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
        setIsLoggedIn(true);

        // Set Sentry user context for error tracking
        setUser({
          id: user.uid,
          email: user.email || undefined,
        });
        addBreadcrumb(`User logged in: ${user.email}`, 'auth', 'info');

        // Bridge Firebase auth with backend JWT expected by protected API routes.
        if (user.email) {
          void fetch(API_ENDPOINTS.AUTH.LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: 'firebase-session' }),
          })
            .then(async (res) => {
              if (!res.ok) {
                throw new Error(`Backend login failed (${res.status})`);
              }
              return res.json();
            })
            .then((payload) => {
              if (payload?.token) {
                localStorage.setItem('auth_token', payload.token);
              }
            })
            .catch((err) => {
              console.warn('[Auth] Failed to bootstrap backend token:', err);
            });
        }
      } else {
        setIsLoggedIn(false);
        setUserId(null);
        setUserEmail(null);
        setUserName(null);
        localStorage.removeItem('auth_token');

        // Clear Sentry user context
        clearUser();
        addBreadcrumb('User logged out', 'auth', 'info');
        setIsInitialLoading(false);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  // 2. Sincronização em Tempo Real com Firestore
  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, 'users', userId);
    
    const unsubSnapshot = onSnapshot(userDocRef, (docSnap: any) => {
      if (docSnap.exists && docSnap.exists()) {
        const data = docSnap.data ? docSnap.data() : {};
        if (data.name) setUserName(data.name);
        if (data.theme) setTheme(data.theme);
        setTransactions(data.transactions || []);
        setAlerts(data.alerts || []);
        setReminders(data.reminders || []);
        setGoals(data.goals || []);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 2000);
      }
      setIsInitialLoading(false);
    }, (error) => {
      if (isSyncPermissionError(error)) {
        console.warn("Permissão/autenticação insuficiente no Firestore:", error);
      } else {
        console.error("Erro na conexão com Firestore:", error);
      }
      if (shouldDisplaySyncConnectionError(error)) {
        setSyncStatus('error');
      } else {
        setSyncStatus('idle');
      }
      setIsInitialLoading(false);
    });

    return () => unsubSnapshot();
  }, [userId]);

  // Aplicar tema escuro/claro
  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const syncToCloud = useCallback(async (updates: Record<string, unknown>) => {
    if (!userId) return;
    setSyncStatus('syncing');
    const userDocRef = doc(db, 'users', userId);
    try {
      await setDoc(userDocRef, updates, { merge: true });
    } catch (e) {
      if (isSyncPermissionError(e)) {
        console.warn("Sincronização bloqueada por permissão/autenticação:", e);
      } else {
        console.error("Erro ao sincronizar:", e);
      }
      if (shouldDisplaySyncConnectionError(e)) {
        setSyncStatus('error');
      } else {
        setSyncStatus('idle');
      }
    }
  }, [userId]);

  const handleLogin = (email: string) => {
    setUserEmail(email);
  };

  const handleAddTransactions = useCallback((newItems: Partial<Transaction>[]) => {
    const items = newItems.map(item => ({
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      date: item.date || new Date().toISOString(),
      amount: item.amount || 0,
      description: item.description || 'Lançamento Flow',
      type: item.type || TransactionType.DESPESA,
      category: item.category || Category.PESSOAL
    })) as Transaction[];
    const updated = [...items, ...transactions];
    setTransactions(updated);
    syncToCloud({ transactions: updated });

    // PART 3 — Emitir evento para cada transação criada
    items.forEach(t => FinancialEventEmitter.transactionCreated(t));
  }, [transactions, syncToCloud]);

  const handleAddReminders = useCallback((newItems: Partial<Reminder>[]) => {
    const items = newItems.map(item => ({
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      completed: false,
      priority: item.priority || 'media',
      date: item.date || new Date().toISOString()
    })) as Reminder[];
    const updated = [...items, ...reminders];
    setReminders(updated);
    syncToCloud({ reminders: updated });
  }, [reminders, syncToCloud]);

  const handleLogout = useCallback(async () => {
    await auth.signOut();
  }, [userId]);

  const handleUpdateAccount = useCallback(async (updated: Account) => {
    await updateAccount(updated);
    setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
  }, []);

  const renderActiveTab = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            userName={userName}
            userEmail={userEmail}
            userId={userId}
            transactions={transactions}
            accounts={accounts}
            alerts={alerts}
            hideValues={hideValues}
            activeNotificationsCount={alerts.length}
            onToggleHideValues={() => setHideValues(!hideValues)}
            onNavigateToOpenFinance={() => setActiveTab('accounts')}
            onNavigateToInsights={() => setActiveTab('insights')}
            onNavigateToCFO={() => setActiveTab('cfo')}
            onNavigateToAutopilot={() => setActiveTab('autopilot')}
            onNavigateToGoals={() => setActiveTab('goals')}
            onNavigateToScanner={() => setActiveTab('scanner')}
            onNavigateToImport={() => setActiveTab('import')}
            onNavigateToOpenBanking={() => setActiveTab('openbanking')}
          />
        );
      case 'assistant':
        return (
          <Assistant 
            reminders={reminders}
            alerts={alerts}
            goals={goals}
            transactions={transactions}
            hideValues={hideValues}
            onToggleComplete={(id) => {
              const updated = reminders.map(r => r.id === id ? {...r, completed: !r.completed} : r);
              setReminders(updated);
              syncToCloud({ reminders: updated });
            }}
            onDeleteReminder={(id) => {
              const updated = reminders.filter(r => r.id !== id);
              setReminders(updated);
              syncToCloud({ reminders: updated });
            }}
            onAddReminder={(r) => handleAddReminders([r])}
            onUpdateReminder={(updatedItem) => {
              const updated = reminders.map(r => r.id === updatedItem.id ? updatedItem : r);
              setReminders(updated);
              syncToCloud({ reminders: updated });
            }}
            onSaveAlert={(a) => {
              const updated = [a, ...alerts];
              setAlerts(updated);
              syncToCloud({ alerts: updated });
            }}
            onDeleteAlert={(id) => {
              const updated = alerts.filter(a => a.id !== id);
              setAlerts(updated);
              syncToCloud({ alerts: updated });
            }}
            onSaveGoal={(g) => {
              const updated = [g, ...goals];
              setGoals(updated);
              syncToCloud({ goals: updated });
            }}
            onDeleteGoal={(id) => {
              const updated = goals.filter(g => g.id !== id);
              setGoals(updated);
              syncToCloud({ goals: updated });
            }}
            onUpdateGoal={(updatedGoal) => {
              const updated = goals.map(g => g.id === updatedGoal.id ? updatedGoal : g);
              setGoals(updated);
              syncToCloud({ goals: updated });
            }}
          />
        );
      case 'analytics':
        return (
          <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-24 overflow-visible">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-black text-white tracking-tight leading-none">Analytics</h2>
                <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Visualizações Avançadas</p>
              </div>
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>

            {/* Analytics Content */}
            <AdvancedAnalytics transactions={transactions} hideValues={hideValues} />
          </div>
        );
      case 'flow':
        return <CashFlow transactions={transactions} hideValues={hideValues} theme={theme} />;
      case 'history':
        return (
          <TransactionList 
            transactions={transactions} 
            hideValues={hideValues}
            onDelete={(id) => {
              const updated = transactions.filter(t => t.id !== id);
              setTransactions(updated);
              syncToCloud({ transactions: updated });
            }}
            onDeleteMultiple={(ids) => {
              const updated = transactions.filter(t => !ids.includes(t.id));
              setTransactions(updated);
              syncToCloud({ transactions: updated });
            }}
            onUpdate={(updatedItem) => {
              const updated = transactions.map(t => t.id === updatedItem.id ? updatedItem : t);
              setTransactions(updated);
              syncToCloud({ transactions: updated });
            }}
          />
        );
      case 'autopilot':
        return (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <AutopilotPage
              transactions={transactions}
              accounts={accounts}
              userId={userId ?? 'local'}
              hideValues={hideValues}
            />
          </Suspense>
        );
      case 'cfo':
        return (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <AICFOPage
              transactions={transactions}
              accounts={accounts}
              userId={userId ?? 'local'}
              hideValues={hideValues}
            />
          </Suspense>
        );
      case 'insights':
        return (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <InsightsPage
              transactions={transactions}
              userId={userId ?? 'local'}
              hideValues={hideValues}
            />
          </Suspense>
        );
      case 'goals':
        return (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <GoalsPage
              userId={userId ?? 'local'}
              hideValues={hideValues}
            />
          </Suspense>
        );
      case 'scanner':
        return (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <ReceiptScannerPage
              hideValues={hideValues}
              onAddTransaction={handleAddTransactions}
            />
          </Suspense>
        );
      case 'import':
        return (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <ImportTransactionsPage
              transactions={transactions}
              userId={userId ?? 'local'}
              hideValues={hideValues}
              onAddTransactions={handleAddTransactions}
            />
          </Suspense>
        );
      case 'openbanking':
        return (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <OpenBankingPage
              userId={userId ?? 'local'}
              transactions={transactions}
              accounts={accounts}
              hideValues={hideValues}
              onNewTransactions={handleAddTransactions}
              onUpdateAccount={handleUpdateAccount}
            />
          </Suspense>
        );
      case 'aicontrol':
        return IS_DEV ? (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <AIControlPanel
              transactions={transactions}
              accounts={accounts}
              userId={userId ?? 'local'}
            />
          </Suspense>
        ) : null;
      case 'accounts':
        return userId ? (
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" size={24} /></div>}>
            <AccountsPage
              userId={userId}
              hideValues={hideValues}
            />
          </Suspense>
        ) : null;
      case 'settings':
        return (
          <Settings 
            userName={userName}
            userEmail={userEmail}
            theme={theme}
            onUpdateProfile={(name) => {
              setUserName(name);
              syncToCloud({ name });
            }}
            onLogout={handleLogout}
            onThemeChange={(t) => {
              setTheme(t);
              syncToCloud({ theme: t });
            }}
          />
        );
      case 'performance':
        return (
          <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-24 overflow-visible">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-amber-500/20 shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-black text-white tracking-tight leading-none">Performance</h2>
                <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Monitoramento em Tempo Real</p>
              </div>
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
                <Activity size={20} />
              </div>
            </div>

            {/* Performance Monitor Content */}
            <PerformanceMonitor />
          </div>
        );
      default:
        return null;
    }
  };

  if (isInitialLoading) {
    return (
      <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Iniciando Flow Finanças...</p>
      </div>
    );
  }

  if (!isLoggedIn) return <Login onLogin={handleLogin} />;
  
  if (isLoggedIn && !userName) {
    return <NamePromptModal onSave={(name) => { setUserName(name); syncToCloud({ name }); }} />;
  }

  return (
    <ErrorBoundary onError={(error, errorInfo) => {
      console.error('[App] Error caught by boundary:', error, errorInfo);
      // TODO: Send to Sentry or error tracking service
    }}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 pb-20 overflow-visible">
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500">
        {syncStatus === 'syncing' && (
          <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-2xl animate-in slide-in-from-top-4">
            <Loader2 size={12} className="text-indigo-400 animate-spin" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">Gravando na Nuvem...</span>
          </div>
        )}
        {syncStatus === 'synced' && (
          <div className="bg-emerald-500/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 border border-white/20 shadow-2xl animate-in zoom-in-95">
            <CloudCheck size={12} className="text-white" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">Sincronizado</span>
          </div>
        )}
        {syncStatus === 'error' && (
          <div className="bg-rose-500 px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl animate-bounce">
            <CloudOff size={12} className="text-white" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">Erro de Conexão</span>
          </div>
        )}
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6 pb-24">
        {renderActiveTab()}
      </div>

      <style>{`
        @keyframes liquid {
          0% { transform: scale(1); border-radius: 1.8rem; }
          50% { transform: scale(1.05); border-radius: 2.5rem; }
          100% { transform: scale(1); border-radius: 1.8rem; }
        }
        @keyframes liquid-active {
          0% { transform: scale(0.95); border-radius: 2.0rem; }
          50% { transform: scale(0.85); border-radius: 2.8rem; }
          100% { transform: scale(0.95); border-radius: 2.0rem; }
        }
        @keyframes glow {
          0% { box-shadow: 0 15px 40px -5px rgba(79,70,229,0.5); }
          50% { box-shadow: 0 20px 50px -5px rgba(124,58,237,0.6); }
          100% { box-shadow: 0 15px 40px -5px rgba(79,70,229,0.5); }
        }
        .btn-liquid:hover {
          animation: liquid 2s infinite ease-in-out, glow 2s infinite ease-in-out;
        }
        .btn-liquid:active {
          animation: liquid-active 0.6s infinite ease-in-out, glow 0.6s infinite ease-in-out;
        }
      `}</style>
      <button 
        onClick={() => setShowAIInput(true)}
        className="fixed bottom-24 right-6 w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-[0_15px_40px_-5px_rgba(79,70,229,0.5)] flex items-center justify-center z-50 hover:scale-110 active:scale-90 transition-all duration-300 btn-liquid rounded-[1.8rem]"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 px-1 py-3 flex justify-between items-center z-[60] shadow-lg">
        <NavButton active={activeTab === 'dashboard'}  onClick={() => setActiveTab('dashboard')}  icon={<LayoutDashboard size={17} />} label="Início" />
        <NavButton active={activeTab === 'cfo'}        onClick={() => setActiveTab('cfo')}        icon={<MessageSquare size={17} />}   label="AI CFO" />
        <NavButton active={activeTab === 'autopilot'}  onClick={() => setActiveTab('autopilot')}  icon={<Zap size={17} />}             label="Autopilot" />
        <NavButton active={activeTab === 'insights'}   onClick={() => setActiveTab('insights')}   icon={<Sparkles size={17} />}        label="Insights" />
        <NavButton active={activeTab === 'analytics'}  onClick={() => setActiveTab('analytics')}  icon={<BarChart3 size={17} />}        label="Analytics" />
        <NavButton active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} icon={<Activity size={17} />}        label="Performance" />
        <NavButton active={activeTab === 'accounts'}   onClick={() => setActiveTab('accounts')}   icon={<Landmark size={17} />}        label="Contas" />
        <NavButton active={activeTab === 'openbanking'} onClick={() => setActiveTab('openbanking')} icon={<Building2 size={17} />}      label="Open Bank" />
        <NavButton active={activeTab === 'flow'}       onClick={() => setActiveTab('flow')}       icon={<TrendingUp size={17} />}      label="Fluxo" />
        <NavButton active={activeTab === 'history'}    onClick={() => setActiveTab('history')}    icon={<History size={17} />}         label="Histórico" />
        <NavButton active={activeTab === 'import'}     onClick={() => setActiveTab('import')}     icon={<Download size={17} />}        label="Importar" />
        <NavButton active={activeTab === 'settings'}   onClick={() => setActiveTab('settings')}   icon={<SettingsIcon size={17} />}    label="Ajustes" />
        {IS_DEV && (
          <NavButton active={activeTab === 'aicontrol'} onClick={() => setActiveTab('aicontrol')} icon={<Terminal size={17} />} label="AI Lab" />
        )}
      </nav>

      {showAIInput && (
        <AIInput 
          onClose={() => setShowAIInput(false)} 
          onAddTransactions={handleAddTransactions}
          onAddReminders={handleAddReminders}
          accounts={accounts}
          userId={userId ?? 'local'}
        />
      )}

      {/* DEV ONLY — AI Debug Panel */}
      {IS_DEV && <AIDebugPanel />}
      
      {/* DEV ONLY — AI Task Queue Monitor */}
      {IS_DEV && <AITaskQueueMonitor />}
      </div>
    </ErrorBoundary>
  );
};

// Static class maps for Tailwind static analysis
const NAV_BUTTON_CLASS_MAP = {
  buttonBase: 'flex flex-col items-center gap-1 transition-all',
  active: 'text-indigo-600 dark:text-indigo-400 scale-110',
  inactive: 'text-slate-400 dark:text-slate-600',
  iconActive: 'p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10',
  iconInactive: 'p-1.5 rounded-xl',
  label: 'text-[8px] font-black uppercase tracking-widest'
};

const NavButton: React.FC<{active: boolean; onClick: () => void; icon: React.ReactNode; label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`${NAV_BUTTON_CLASS_MAP.buttonBase} ${active ? NAV_BUTTON_CLASS_MAP.active : NAV_BUTTON_CLASS_MAP.inactive}`}>
    <div className={active ? NAV_BUTTON_CLASS_MAP.iconActive : NAV_BUTTON_CLASS_MAP.iconInactive}>{icon}</div>
    <span className={NAV_BUTTON_CLASS_MAP.label}>{label}</span>
  </button>
);

export default App;