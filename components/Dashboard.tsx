
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../utils/helpers';
import { Transaction, TransactionType, Alert } from '../types';
import { Account } from '../models/Account';
import { GeminiService } from '../services/geminiService';
import { generateFinancialInsights } from '../src/ai/insightGenerator';
import { runFinancialAutopilot } from '../src/ai/financialAutopilot';
import { buildCashflowPrediction } from '../src/ai/riskAnalyzer';
import { getAdaptiveLearningStats } from '../src/ai/adaptiveAIEngine';
import { predictCashflow, predictionTrend } from '../src/finance/cashflowPredictor';
import { calculateMoneyDistribution } from '../src/finance/moneyMap';
import { getGoals, calculateGoalProgress } from '../src/finance/goalService';
import { getConnections, formatLastSync } from '../services/integrations/openBankingService';
import { detectFinancialLeaks, FinancialLeak } from '../src/ai/leakDetector';
import { detectSalary } from '../src/ai/salaryDetector';
import { detectFixedExpenses } from '../src/ai/fixedExpenseDetector';
import { generateMonthlyReport, FinancialReport } from '../src/finance/reportEngine';
import { getSyncStatusSummary } from '../src/finance/bankSyncEngine';
import { simulateFinancialScenario, FinancialSimulationResult } from '../src/ai/financialSimulator';
import { calculateCashflowSummary } from '../src/engines/finance/cashflowEngine';
import { 
  Eye, EyeOff, BrainCircuit, Loader2, Landmark, LayoutDashboard,
  ArrowUpRight, ArrowDownRight, Wallet, CreditCard,
  Sun, Moon, Sunrise,
  Zap, AlertTriangle, X, Bot, Lightbulb, Sparkles, GraduationCap,
  TrendingUp, TrendingDown, Minus, Target, MapPin, Receipt,
  Building2, Wifi, WifiOff, RefreshCw, DollarSign, CalendarClock, ShieldCheck,
  Download
} from 'lucide-react';

interface DashboardProps {
  userEmail: string | null;
  userName: string | null;
  userId?: string | null;
  transactions: Transaction[];
  accounts?: Account[];
  alerts: Alert[];
  hideValues: boolean;
  activeNotificationsCount: number;
  onToggleHideValues: () => void;
  onNavigateToOpenFinance: () => void;
  onNavigateToInsights?: () => void;
  onNavigateToCFO?: () => void;
  onNavigateToAutopilot?: () => void;
  onNavigateToGoals?: () => void;
  onNavigateToScanner?: () => void;
  onNavigateToImport?: () => void;
  onNavigateToOpenBanking?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  userEmail, userName, userId, transactions, accounts = [], alerts, hideValues, 
  onToggleHideValues, onNavigateToOpenFinance, onNavigateToInsights, onNavigateToCFO,
  onNavigateToAutopilot, onNavigateToGoals, onNavigateToScanner, onNavigateToImport,
  onNavigateToOpenBanking
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [isConsultancyOpen, setIsConsultancyOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const gemini = useRef(new GeminiService());

  // Filtrar transações por conta selecionada
  const filteredTransactions = useMemo(() => {
    if (selectedAccountId === 'all') return transactions;
    return transactions.filter(t => t.account_id === selectedAccountId);
  }, [transactions, selectedAccountId]);

  // Insight local gerado dinamicamente para o widget de preview
  const latestInsight = useMemo(() => {
    const insights = generateFinancialInsights(filteredTransactions);
    return insights[0] ?? null;
  }, [filteredTransactions]);

  // Top 3 ações do Autopilot para o widget do Dashboard
  const autopilotActions = useMemo(() => {
    const prediction = buildCashflowPrediction(filteredTransactions);
    const insights = generateFinancialInsights(filteredTransactions);
    return runFinancialAutopilot(accounts, filteredTransactions, prediction, insights).slice(0, 3);
  }, [accounts, filteredTransactions]);

  // Adaptive Learning stats para o widget
  const adaptiveStats = useMemo(
    () => getAdaptiveLearningStats(userId ?? 'local'),
    [userId]
  );

  // Cashflow forecast (90 dias)
  const cashflowForecast = useMemo(
    () => predictCashflow(accounts, filteredTransactions),
    [accounts, filteredTransactions]
  );

  // Money distribution (últimos 30 dias)
  const moneyMap = useMemo(
    () => calculateMoneyDistribution(filteredTransactions, 30),
    [filteredTransactions]
  );

  // Goals preview (top 3 ativos)
  const goalsPreview = useMemo(() => {
    const all = getGoals(userId ?? 'local');
    return all
      .filter(g => calculateGoalProgress(g).status !== 'completed')
      .slice(0, 3);
  }, [userId]);

  // Open Banking connections preview
  const bankConnections = useMemo(
    () => getConnections(userId ?? 'local'),
    [userId]
  );

  // Salary detection for dashboard hint
  const salaryInfo = useMemo(
    () => detectSalary(transactions),
    [transactions]
  );

  // Fixed expenses summary for dashboard hint
  const fixedExpensesInfo = useMemo(
    () => detectFixedExpenses(transactions, salaryInfo.total_monthly || undefined),
    [transactions, salaryInfo.total_monthly]
  );

  // Bank sync status
  const syncStatus = useMemo(
    () => getSyncStatusSummary(userId ?? 'local'),
    [userId, bankConnections]
  );

  // Financial Leaks
  const financialLeaks = useMemo(
    () => detectFinancialLeaks(filteredTransactions),
    [filteredTransactions]
  );

  // Monthly Report
  const monthlyReport = useMemo(
    () => generateMonthlyReport(filteredTransactions),
    [filteredTransactions]
  );

  // Simulation example (extra spending)
  const simulationResult = useMemo(() => {
    if (filteredTransactions.length === 0) return null;
    return simulateFinancialScenario(accounts, filteredTransactions, {
      type: 'extra_spending',
      amount: 500,
      description: 'uma viagem de fim de semana'
    });
  }, [accounts, filteredTransactions]);

  const hasCriticalAlerts = useMemo(() => {
    return aiInsights.some(insight => insight.type === 'alerta');
  }, [aiInsights]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bom dia', icon: <Sunrise size={14} className="text-amber-400" /> };
    if (hour < 18) return { text: 'Boa tarde', icon: <Sun size={14} className="text-orange-400" /> };
    return { text: 'Boa noite', icon: <Moon size={14} className="text-indigo-300" /> };
  }, []);

  const relevantTransactionsHash = useMemo(() => {
    return transactions.slice(0, 10).map(t => t.id + t.amount).join('|');
  }, [transactions]);

  useEffect(() => {
    const fetchInsights = async () => {
      if (transactions.length > 0) {
        setIsAiLoading(true);
        try {
          const insights = await gemini.current.generateDailyInsights(transactions.slice(0, 20));
          setAiInsights(insights);
        } catch (error) {
          console.error("Erro ao carregar insights:", error);
        } finally {
          setIsAiLoading(false);
        }
      }
    };
    fetchInsights();
  }, [relevantTransactionsHash]);

  const summary = useMemo(
    () => calculateCashflowSummary(filteredTransactions),
    [filteredTransactions]
  );

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + Math.abs(a.balance), 0), [accounts]);

  const balance = summary.income - summary.expenses;

  const formatVal = (amt: number) => 
    formatCurrency(amt);

  const shadowStyle = hasCriticalAlerts 
    ? 'shadow-[0_40px_120px_-20px_rgba(244,63,94,0.45),0_20px_40px_-15px_rgba(244,63,94,0.2)]' 
    : 'shadow-[0_40px_120px_-20px_rgba(99,102,241,0.45),0_20px_40px_-15px_rgba(99,102,241,0.2)]';

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-24 overflow-visible">
      {/* Header Padronizado (Conforme solicitado, igual às outras abas) */}
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Início</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Inteligência de Fluxo</p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
          <LayoutDashboard size={22} />
        </div>
      </div>

      {/* Account Selector */}
      {accounts.length > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedAccountId('all')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-tight whitespace-nowrap transition-all shrink-0 ${
                selectedAccountId === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Wallet size={12} /> Todas
            </button>
            {accounts.map(account => {
              const accountIcons: Record<string, React.ReactNode> = {
                bank: <Landmark size={12} />,
                cash: <Wallet size={12} />,
                credit_card: <CreditCard size={12} />,
                investment: <TrendingUp size={12} />,
              };
              const sel = selectedAccountId === account.id;
              return (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-tight whitespace-nowrap transition-all shrink-0 ${
                    sel
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {accountIcons[account.type] ?? <Wallet size={12} />}
                  {account.name}
                  {!hideValues && (
                    <span className={`text-[9px] font-bold ${sel ? 'text-white/70' : 'text-slate-400'}`}>
                      {formatVal(account.balance)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Card Principal Claro com Saudação Personalizada */}
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-7 text-slate-900 dark:text-white relative overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 group mt-1 transition-all">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full -mr-24 -mt-24 blur-[80px] pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-indigo-100/50 dark:border-indigo-500/20">
              <Wallet size={12} /> 
              {selectedAccountId !== 'all' ? 'Saldo da Conta' : 'Patrimônio Total'}
            </div>
            <button 
              onClick={onToggleHideValues}
              className="p-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-90 text-slate-400 hover:text-indigo-600 border border-slate-100 dark:border-slate-700"
            >
              {hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          <div className="mt-1">
            <div className="flex items-center gap-1.5 mb-2 ml-1">
              <span className="text-slate-400 dark:text-slate-500">{greeting.icon}</span>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {greeting.text}, <span className="text-indigo-500 dark:text-indigo-400">{userName?.split(' ')[0] || 'Usuário'}</span>
              </p>
            </div>
            <h2 className="text-4xl font-black tracking-tighter leading-none mb-1 text-slate-900 dark:text-white">
              {hideValues ? 'R$ •••••' : formatVal(balance)}
            </h2>
            <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
              {selectedAccountId !== 'all' ? 'Saldo Disponível' : 'Disponibilidade de Caixa Total'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-4 rounded-3xl">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ArrowUpRight size={10} className="text-emerald-500" /> Entradas</p>
              <p className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-200">{hideValues ? '••••' : formatVal(summary.income)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-4 rounded-3xl">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ArrowDownRight size={10} className="text-rose-500" /> Saídas</p>
              <p className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-200">{hideValues ? '••••' : formatVal(summary.expenses)}</p>
            </div>
          </div>

          <button 
            onClick={onNavigateToOpenFinance}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center gap-3 text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <Landmark size={16} /> Gerenciar Contas Bancárias

                    {/* Account Distribution Bars */}
                    {selectedAccountId === 'all' && accounts.length > 1 && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-3">Distribuição por Conta</p>
                        <div className="space-y-2.5">
                          {accounts.map(acc => {
                            const pct = totalBalance > 0 ? (Math.abs(acc.balance) / totalBalance) * 100 : 0;
                            const typeColors: Record<string, string> = {
                              bank: 'bg-blue-500',
                              cash: 'bg-emerald-500',
                              credit_card: 'bg-violet-500',
                              investment: 'bg-amber-500',
                            };
                            return (
                              <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)} className="w-full flex items-center gap-2 group">
                                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 w-20 truncate text-left group-hover:text-indigo-500 transition-colors">{acc.name}</span>
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full ${typeColors[acc.type] ?? 'bg-indigo-500'} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[9px] font-black text-slate-400 shrink-0">{hideValues ? '••••' : formatVal(acc.balance)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
          </button>
        </div>
      </div>

      {/* Latest Insight Widget */}
      {latestInsight && onNavigateToInsights && (
        <button
          onClick={onNavigateToInsights}
          className="w-full text-left bg-white dark:bg-slate-800 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all active:scale-[0.98] group"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            latestInsight.severity === 'high' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' :
            latestInsight.severity === 'medium' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' :
            'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500'
          }`}>
            <Zap size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Último Insight</p>
            <p className="text-xs font-bold text-slate-800 dark:text-white leading-snug line-clamp-2">{latestInsight.message}</p>
          </div>
          <ArrowUpRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-indigo-500 transition-colors" />
        </button>
      )}

      {/* AI Learning Widget — PART 9 */}
      {transactions.length >= 3 && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            <div className="relative w-10 h-10 shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <GraduationCap size={18} className="text-white" />
              </div>
              {adaptiveStats.isLearning && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-800 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 dark:text-white leading-none">AI Learning</p>
              <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                {adaptiveStats.isLearning
                  ? 'Seu assistente financeiro está aprendendo seus hábitos de gasto.'
                  : 'Adicione mais transações para ativar o aprendizado.'}
              </p>
            </div>
          </div>

          {/* Stats grid */}
          {adaptiveStats.isLearning && (
            <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-700">
              {[
                { label: 'Padrões', value: adaptiveStats.patternCount },
                { label: 'Memórias', value: adaptiveStats.memoryCount },
                { label: 'Transações', value: transactions.filter(t => !t.generated).length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white dark:bg-slate-800 px-4 py-3 text-center">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{value}</p>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Learning progress bar */}
          {adaptiveStats.isLearning && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Nível de aprendizado</p>
                <p className="text-[7px] font-black text-indigo-500">
                  {adaptiveStats.patternCount >= 5 ? 'Avançado' : adaptiveStats.patternCount >= 3 ? 'Intermediário' : 'Iniciante'}
                </p>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, (adaptiveStats.patternCount / 5) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CASHFLOW FORECAST WIDGET ─────────────────────────────────────── */}
      {transactions.length >= 2 && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-indigo-500" />
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Previsão de Caixa</p>
              <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">Simulação para 90 dias</p>
            </div>
          </div>

          {/* 3-column forecast */}
          <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-700">
            {[
              { label: '7 dias', value: cashflowForecast.balance_7_days,  base: cashflowForecast.current_balance },
              { label: '30 dias', value: cashflowForecast.balance_30_days, base: cashflowForecast.current_balance },
              { label: '90 dias', value: cashflowForecast.balance_90_days, base: cashflowForecast.current_balance },
            ].map(({ label, value, base }) => {
              const trend = predictionTrend(base, value);
              const trendIcon = trend === 'up'
                ? <TrendingUp size={9} className="text-emerald-500" />
                : trend === 'down'
                ? <TrendingDown size={9} className="text-rose-500" />
                : <Minus size={9} className="text-slate-400" />;
              const valueColor = value >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500';
              return (
                <div key={label} className="bg-white dark:bg-slate-800 px-3 py-3 text-center">
                  <p className={`text-sm font-black ${valueColor}`}>
                    {hideValues ? '••••' : formatCurrency(value, 'pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    {trendIcon}
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lowest point warning */}
          {cashflowForecast.lowest_point.balance < 0 && (
            <div className="mx-4 my-3 flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
              <AlertTriangle size={11} className="text-rose-500 shrink-0" />
              <p className="text-[8px] text-rose-600 dark:text-rose-400 font-bold">
                Saldo pode ficar negativo em {new Date(cashflowForecast.lowest_point.date).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── FINANCIAL GOALS WIDGET ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <button
          onClick={onNavigateToGoals}
          className="w-full flex items-center gap-3 px-5 pt-5 pb-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
        >
          <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
            <Target size={16} className="text-emerald-500" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Metas Financeiras</p>
            <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">
              {goalsPreview.length === 0 ? 'Nenhuma meta ativa' : `${goalsPreview.length} meta${goalsPreview.length !== 1 ? 's' : ''} em andamento`}
            </p>
          </div>
          <ArrowUpRight size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
        </button>

        {goalsPreview.length > 0 ? (
          <div className="px-5 pb-5 flex flex-col gap-2 border-t border-slate-100 dark:border-slate-700">
            {goalsPreview.map(goal => {
              const prog = calculateGoalProgress(goal);
              return (
                <div key={goal.id} className="flex items-center gap-3 py-2">
                  <span className="text-base shrink-0">{goal.icon ?? '🎯'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[10px] font-black text-slate-800 dark:text-white truncate">{goal.name}</p>
                      <p className="text-[8px] font-black text-slate-400 shrink-0">{prog.progress_percentage}%</p>
                    </div>
                    <div className="w-full h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${prog.progress_percentage}%`, backgroundColor: goal.color ?? '#10b981' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700">
            <p className="text-[9px] text-slate-400 font-bold py-3 text-center">
              Defina objetivos financeiros e acompanhe o progresso
            </p>
          </div>
        )}
      </div>

      {/* ── MONEY MAP / DISTRIBUTION WIDGET ─────────────────────────────── */}
      {moneyMap.distribution.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="w-9 h-9 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-center justify-center shrink-0">
              <MapPin size={16} className="text-violet-500" />
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Money Map</p>
              <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">{moneyMap.period_label}</p>
            </div>
            <p className="text-[8px] font-black text-slate-400">
              {hideValues ? '••••' : formatCurrency(moneyMap.total_expenses)}
            </p>
          </div>

          {/* Segmented bar */}
          <div className="px-5 pb-2 border-t border-slate-100 dark:border-slate-700 pt-3">
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {moneyMap.distribution.map(item => (
                <div
                  key={item.category}
                  style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  title={`${item.category}: ${item.percentage}%`}
                />
              ))}
            </div>
          </div>

          {/* Category list */}
          <div className="px-5 pb-5 flex flex-col gap-2">
            {moneyMap.distribution.slice(0, 4).map(item => {
              const trendIcon = item.trend === 'up'
                ? <TrendingUp size={9} className="text-rose-400" />
                : item.trend === 'down'
                ? <TrendingDown size={9} className="text-emerald-400" />
                : null;
              return (
                <div key={item.category} className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <p className="flex-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{item.category}</p>
                  <div className="flex items-center gap-1">
                    {trendIcon}
                    <p className="text-[9px] font-black text-slate-500">{item.percentage}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SCANNER SHORTCUT ─────────────────────────────────────────────── */}
      {onNavigateToScanner && (
        <button
          onClick={onNavigateToScanner}
          className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 p-5 shadow-sm hover:border-violet-300 dark:hover:border-violet-500/40 hover:shadow-violet-500/10 active:scale-[0.98] transition-all group"
        >
          <div className="w-11 h-11 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-violet-100 dark:group-hover:bg-violet-500/20 transition-colors">
            <Receipt size={20} className="text-violet-500" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black text-slate-900 dark:text-white text-sm leading-none">Scanner de Recibo</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Foto → transação automática via IA
            </p>
          </div>
          <ArrowUpRight size={16} className="text-slate-300 group-hover:text-violet-500 transition-colors" />
        </button>
      )}

      {/* ── CONNECTED BANKS WIDGET (Part 6) ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Widget header */}
        <button
          onClick={onNavigateToOpenBanking}
          className="w-full flex items-center gap-3 px-5 pt-5 pb-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
        >
          <div className="w-9 h-9 bg-slate-900 dark:bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Open Banking</p>
            <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">
              {bankConnections.length === 0
                ? 'Nenhum banco conectado'
                : `${bankConnections.length} banco${bankConnections.length !== 1 ? 's' : ''} conectado${bankConnections.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {/* Sync needs indicator */}
          {syncStatus.needs_sync && bankConnections.length > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-lg mr-1">
              <CalendarClock size={9} className="text-amber-500" />
              <span className="text-[7px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Sync</span>
            </div>
          )}
          <ArrowUpRight size={14} className="text-slate-300 group-hover:text-slate-600 dark:group-hover:text-white transition-colors" />
        </button>

        {bankConnections.length > 0 ? (
          <>
            {/* Bank rows with name + balance + last sync */}
            <div className="px-5 pb-3 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2.5 pt-3">
              {bankConnections.slice(0, 3).map(conn => {
                const isError   = conn.connection_status === 'error';
                const isSyncing = conn.connection_status === 'syncing';
                return (
                  <div key={conn.id} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ backgroundColor: conn.bank_color ? `${conn.bank_color}18` : '#6366f118', border: `1px solid ${conn.bank_color ?? '#6366f1'}25` }}
                    >
                      {conn.bank_logo ?? '🏦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-800 dark:text-white truncate leading-none">{conn.bank_name}</p>
                      <p className="text-[8px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                        {isSyncing
                          ? <><RefreshCw size={7} className="animate-spin text-sky-400" /> Sincronizando…</>
                          : isError
                          ? <><WifiOff size={7} className="text-rose-400" /> Erro</>
                          : <><Wifi size={7} className="text-emerald-500" /> {formatLastSync(conn.last_sync)}</>
                        }
                      </p>
                    </div>
                    {/* Balance column */}
                    <div className="text-right shrink-0">
                      {conn.balance !== undefined && !hideValues ? (
                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-200">
                          {formatCurrency(conn.balance, 'pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                        </p>
                      ) : conn.balance !== undefined && hideValues ? (
                        <p className="text-[10px] font-black text-slate-400">••••</p>
                      ) : null}
                      <div className={`w-1.5 h-1.5 rounded-full ml-auto mt-0.5 ${
                        isSyncing ? 'bg-sky-400 animate-pulse'
                        : isError  ? 'bg-rose-400'
                        : 'bg-emerald-400'
                      }`} />
                    </div>
                  </div>
                );
              })}
              {bankConnections.length > 3 && (
                <p className="text-[8px] text-slate-400 font-bold text-center pt-0.5">
                  +{bankConnections.length - 3} bancos
                </p>
              )}
            </div>

            {/* Salary + Fixed Expense mini-insights */}
            {(salaryInfo.detected || fixedExpensesInfo.count > 0) && (
              <div className="mx-5 mb-4 grid grid-cols-2 gap-2">
                {salaryInfo.detected && salaryInfo.primary_income && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2">
                    <DollarSign size={12} className="text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[7px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Salário</p>
                      <p className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                        {hideValues ? '••••' : formatCurrency(salaryInfo.primary_income.amount, 'pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                )}
                {fixedExpensesInfo.count > 0 && (
                  <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl px-3 py-2">
                    <ShieldCheck size={12} className="text-rose-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[7px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest leading-none">Fixos/mês</p>
                      <p className="text-[9px] font-black text-rose-600 dark:text-rose-300 mt-0.5 truncate">
                        {hideValues ? '••••' : formatCurrency(fixedExpensesInfo.total_monthly, 'pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700">
            <p className="text-[9px] text-slate-400 font-bold py-3 text-center">
              Conecte seu banco para sincronização automática
            </p>
          </div>
        )}
      </div>

      {/* ── IMPORT SHORTCUT ──────────────────────────────────────────────── */}
      {onNavigateToImport && (
        <button
          onClick={onNavigateToImport}
          className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 p-5 shadow-sm hover:border-sky-300 dark:hover:border-sky-500/40 hover:shadow-sky-500/10 active:scale-[0.98] transition-all group"
        >
          <div className="w-11 h-11 bg-sky-50 dark:bg-sky-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-sky-100 dark:group-hover:bg-sky-500/20 transition-colors">
            <Download size={20} className="text-sky-500" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black text-slate-900 dark:text-white text-sm leading-none">Importar Extrato</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              OFX · CSV · PDF — classificação automática
            </p>
          </div>
          <ArrowUpRight size={16} className="text-slate-300 group-hover:text-sky-500 transition-colors" />
        </button>
      )}

      {/* Ask AI Advisor Button */}
      {onNavigateToCFO && (
        <button
          onClick={onNavigateToCFO}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-[2rem] p-5 flex items-center gap-4 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] transition-all group"
        >
          <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0">
            <BrainCircuit size={22} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black text-white text-sm leading-none">Perguntar ao AI CFO</p>
            <p className="text-[8px] text-white/70 font-bold uppercase tracking-widest mt-1">Consultor financeiro virtual</p>
          </div>
          <ArrowUpRight size={18} className="text-white/60 group-hover:text-white transition-colors" />
        </button>
      )}

      {/* Financial Autopilot Widget */}
      {onNavigateToAutopilot && autopilotActions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <button
            onClick={onNavigateToAutopilot}
            className="w-full flex items-center gap-3 px-5 pt-5 pb-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
          >
            <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Bot size={16} className="text-indigo-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Financial Autopilot</p>
              <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">{autopilotActions.length} ação{autopilotActions.length > 1 ? 'ões' : ''} gerada{autopilotActions.length > 1 ? 's' : ''}</p>
            </div>
            <ArrowUpRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
          </button>
          <div className="px-5 pb-5 flex flex-col gap-2">
            {autopilotActions.map(action => {
              const iconMap = {
                warning:      <AlertTriangle size={11} className="text-rose-500" />,
                suggestion:   <Lightbulb size={11} className="text-amber-500" />,
                optimization: <Zap size={11} className="text-indigo-500" />,
                insight:      <Sparkles size={11} className="text-violet-500" />,
              };
              const bgMap = {
                warning:      'bg-rose-50 dark:bg-rose-500/10',
                suggestion:   'bg-amber-50 dark:bg-amber-500/10',
                optimization: 'bg-indigo-50 dark:bg-indigo-500/10',
                insight:      'bg-violet-50 dark:bg-violet-500/10',
              };
              return (
                <div key={action.id} className={`flex items-start gap-2.5 p-3 ${bgMap[action.type]} rounded-2xl`}>
                  <span className="mt-0.5 shrink-0">{iconMap[action.type]}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-800 dark:text-white truncate">{action.title}</p>
                    <p className="text-[8px] text-slate-500 dark:text-slate-400 font-bold leading-snug line-clamp-1 mt-0.5">{action.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FINANCIAL LEAKS WIDGET ──────────────────────────────────────── */}
      {financialLeaks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="w-9 h-9 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-rose-500" />
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vazamentos Financeiros</p>
              <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">
                {financialLeaks.length} vazamento{financialLeaks.length > 1 ? 's' : ''} detectado{financialLeaks.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="px-5 pb-5 flex flex-col gap-2">
            {financialLeaks.slice(0, 3).map((leak, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
                <AlertTriangle size={11} className="text-rose-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-800 dark:text-white truncate">{leak.merchant}</p>
                  <p className="text-[8px] text-slate-500 dark:text-slate-400 font-bold leading-snug mt-0.5">
                    {hideValues ? '••••' : formatCurrency(leak.monthly_cost)}/mês - {leak.suggestion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTHLY FINANCIAL REPORT WIDGET ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
            <CalendarClock size={16} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Relatório Mensal</p>
            <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">{monthlyReport.month}</p>
          </div>
          <p className="text-[8px] font-black text-slate-400">
            {hideValues ? '••••' : formatCurrency(monthlyReport.total_expenses)}
          </p>
        </div>
        <div className="px-5 pb-5 flex flex-col gap-2">
          {monthlyReport.top_categories.slice(0, 3).map(cat => (
            <div key={cat.category} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <p className="flex-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{cat.category}</p>
              <p className="text-[9px] font-black text-slate-500">{cat.percentage}%</p>
            </div>
          ))}
          {monthlyReport.insights.length > 0 && (
            <p className="text-[8px] text-slate-400 font-bold mt-2">{monthlyReport.insights[0]}</p>
          )}
        </div>
      </div>

      {/* ── SIMULATION INSIGHTS WIDGET ───────────────────────────────────── */}
      {simulationResult && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="w-9 h-9 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-purple-500" />
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Simulação Financeira</p>
              <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">Cenário: Gasto Extra</p>
            </div>
          </div>
          <div className="px-5 pb-5">
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
              {simulationResult.summary}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Saldo Projetado</p>
              <p className="text-[10px] font-black text-slate-800 dark:text-white">
                {hideValues ? '••••' : formatCurrency(simulationResult.projected_balance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FLOW INTELLIGENCE */}
      <div className="w-full overflow-visible py-10 mt-2">
        <div className={`mx-[-1rem] px-[1rem] overflow-visible`}>
          <div className={`min-h-[140px] ${hasCriticalAlerts ? 'bg-rose-950/20 border-rose-500/20' : 'bg-slate-900 border-white/5'} ${shadowStyle} rounded-[3rem] p-7 flex flex-col justify-between border relative overflow-visible animate-pulse-wiggle transition-all duration-700`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.06)_0%,_transparent_80%)] pointer-events-none rounded-[3rem]"></div>
            
            <div className="flex items-start gap-4 relative z-10">
              <div className={`w-11 h-11 ${hasCriticalAlerts ? 'bg-rose-500/20 text-rose-400 border-rose-500/20' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20'} backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border shadow-inner`}>
                {hasCriticalAlerts ? <AlertTriangle size={22} /> : <Zap size={22} />}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center gap-2">
                  <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase ${hasCriticalAlerts ? 'text-rose-400' : 'text-indigo-400'}`}>Flow Intelligence</h4>
                  <div className={`px-2 py-0.5 ${hasCriticalAlerts ? 'bg-rose-500/10 text-rose-300' : 'bg-indigo-500/10 text-indigo-300'} rounded-lg text-[7px] font-black uppercase`}>Live</div>
                </div>
                <p className={`text-[11px] ${hasCriticalAlerts ? 'text-rose-200' : 'text-slate-200'} italic font-medium leading-relaxed mt-2 line-clamp-2`}>
                  "{isAiLoading ? "Processando insights preditivos..." : aiInsights.length > 0 ? aiInsights[0].description : "Analisando seu comportamento financeiro..."}"
                </p>
              </div>
            </div>
            
            <button 
              onClick={async () => { 
                setIsConsultancyOpen(true); 
                setIsGenerating(true); 
                try { setAiInsights(await gemini.current.generateDailyInsights(transactions)); } catch (e) { console.error(e); }
                setIsGenerating(false); 
              }}
              className={`w-full py-4.5 ${hasCriticalAlerts ? 'bg-rose-600' : 'bg-indigo-600'} text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.15em] hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 relative z-10 mt-6`}
            >
              <BrainCircuit size={18} /> Ver insights agora
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Consultoria Integrado */}
      {isConsultancyOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-7 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Flow Intelligence</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Análise estratégica diária</p>
              </div>
              <button onClick={() => setIsConsultancyOpen(false)} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-full text-slate-400 transition-all active:scale-90">
                <X size={20} />
              </button>
            </div>
            <div className="p-7 overflow-y-auto space-y-4 no-scrollbar">
              {isGenerating ? (
                <div className="py-24 flex flex-col items-center gap-5 text-center">
                  <Loader2 size={40} className="animate-spin text-indigo-600" strokeWidth={3} />
                  <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600 animate-pulse">Cruzando dados de fluxo...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {aiInsights.map((tip, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 animate-in slide-in-from-bottom-3" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-xl ${tip.type === 'alerta' ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
                          <Zap size={14}/>
                        </div>
                        <h4 className={`text-[11px] font-black uppercase tracking-widest ${tip.type === 'alerta' ? 'text-rose-600' : 'text-indigo-600'}`}>{tip.title}</h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-bold leading-relaxed">{tip.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700">
               <button onClick={() => setIsConsultancyOpen(false)} className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Fechar Diagnóstico</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
