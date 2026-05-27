import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Receivable, Transaction, TransactionType, Category } from '../types';
import { formatCurrency } from '../utils/helpers';
import { GeminiService } from '../services/geminiService';
import { getWorkspaceScopedStorageKey } from '../src/utils/workspaceStorage';
import { addMoney } from '../src/security/moneyMath';
import { isReceivablesSourceOfTruthEnabled } from '../src/finance/receivableFeatureFlag';
import {
  buildReceivableStateSummary,
  filterReceivablesByTimeframe,
  isReceivableOverdue,
  isReceivablePending,
} from '../src/finance/receivableService';
import {
  buildCashflowTimeline,
  buildExpenseCategoryData,
  filterTransactionsByTimeframe,
} from '../src/engines/finance/analyticsEngine';
import { calculateCashflowSummary } from '../src/engines/finance/cashflowEngine';
import { logWarn } from '../src/utils/logger';
import { FLOW_CHART_COLORS, FLOW_CHART_UI } from '../src/styles/chartPalette';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import {
  TrendingUp, Target, PieChart as PieIcon, BrainCircuit, X, Loader2,
  Calendar, CheckCircle2, AlertTriangle, Lightbulb, Share2, MessageCircle, FileText, Download, Mail, Check
} from 'lucide-react';

interface CashFlowProps {
  activeWorkspaceId?: string | null;
  activeWorkspaceName?: string | null;
  transactions: Transaction[];
  receivables?: Receivable[];
  hideValues: boolean;
  theme: 'light' | 'dark';
}

const COLORS = FLOW_CHART_COLORS.categories;

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
  hideValues: boolean;
  isPercentage?: boolean;
  total?: number;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, hideValues, isPercentage = false, total = 1 }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;

    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-1">{label || payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-base font-semibold text-slate-900 dark:text-white">{hideValues ? 'R$ ••••' : formatCurrency(value)}</p>
          {isPercentage && (
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-full uppercase tracking-[0.12em]">
              {percent}%
            </span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export interface RevenueStateSummary {
  confirmed: number;
  pending: number;
  overdue: number;
  projected: number;
}

function normalizeStateLabel(state: unknown): 'confirmed' | 'pending' | 'overdue' | null {
  if (typeof state !== 'string') {
    return null;
  }

  const normalized = state.toLowerCase();
  if (normalized === 'confirmed' || normalized === 'confirmado') {
    return 'confirmed';
  }
  if (normalized === 'pending' || normalized === 'pendente') {
    return 'pending';
  }
  if (normalized === 'overdue' || normalized === 'vencido') {
    return 'overdue';
  }

  return null;
}

function classifyRevenueState(transaction: Transaction, referenceDate: Date = new Date()): 'confirmed' | 'pending' | 'overdue' {
  const metadata = transaction as unknown as Record<string, unknown>;
  const explicitState = normalizeStateLabel(metadata.status);
  if (explicitState) {
    return explicitState;
  }

  const transactionDate = new Date(transaction.date).getTime();
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  const endOfToday = startOfToday + (24 * 60 * 60 * 1000) - 1;

  if (transactionDate > endOfToday) {
    return 'pending';
  }

  if (transaction.generated && transactionDate < startOfToday) {
    return 'overdue';
  }

  return 'confirmed';
}

export function calculateRevenueStateSummary(
  transactions: Transaction[],
  receivables: Receivable[] = [],
  referenceDate: Date = new Date(),
  forceReceivablesSourceOfTruth?: boolean,
): RevenueStateSummary {
  const shouldUseReceivables = typeof forceReceivablesSourceOfTruth === 'boolean'
    ? forceReceivablesSourceOfTruth
    : isReceivablesSourceOfTruthEnabled();

  if (shouldUseReceivables) {
    return buildReceivableStateSummary(receivables, referenceDate);
  }

  const incomeTransactions = transactions.filter((transaction) => transaction.type === TransactionType.RECEITA);

  const summary = incomeTransactions.reduce((accumulator, transaction) => {
    const state = classifyRevenueState(transaction, referenceDate);
    if (state === 'pending') {
      return { ...accumulator, pending: addMoney(accumulator.pending, transaction.amount) };
    } else if (state === 'overdue') {
      return { ...accumulator, overdue: addMoney(accumulator.overdue, transaction.amount) };
    }
    return { ...accumulator, confirmed: addMoney(accumulator.confirmed, transaction.amount) };
  }, { confirmed: 0, pending: 0, overdue: 0 });

  return {
    confirmed: summary.confirmed,
    pending: summary.pending,
    overdue: summary.overdue,
    projected: addMoney(summary.pending, summary.overdue),
  };
}

const STATE_TONE_CLASS_MAP: Record<'confirmed' | 'projected' | 'pending' | 'overdue', string> = {
  confirmed: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300',
  projected: 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200',
  pending: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300',
  overdue: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300',
};

const StateMetricCard: React.FC<{ label: string; value: string; tone: 'confirmed' | 'projected' | 'pending' | 'overdue' }> = ({ label, value, tone }) => (
  <div className={`rounded-2xl border px-4 py-3 ${STATE_TONE_CLASS_MAP[tone]}`}>
    <p className="text-sm font-semibold uppercase tracking-[0.16em] opacity-80">{label}</p>
    <p className="mt-1 text-xl font-medium tracking-tight">{value}</p>
  </div>
);

const EmptyChartState: React.FC<{
  title: string;
  message: string;
  hint: string;
  icon: React.ReactNode;
}> = ({ title, message, hint, icon }) => (
  <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
    <div className="max-w-xs space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  </div>
);

const RevenueSectionButton: React.FC<{
  section: RevenueSection;
  active: boolean;
  onClick: (section: RevenueSection) => void;
  icon: React.ReactNode;
}> = ({ section, active, onClick, icon }) => {
  const meta = REVENUE_SECTION_META[section];

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={`${meta.label}: ${meta.description}`}
      onClick={() => onClick(section)}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-full border px-4 py-2 text-left transition-all ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-md dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          active
            ? 'border-white/20 bg-white/10 text-current dark:border-slate-900/10 dark:bg-slate-900/10'
            : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold uppercase tracking-[0.14em]">{meta.label}</span>
        <span className={`mt-0.5 block text-[11px] font-medium leading-tight ${active ? 'text-white/75 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500'}`}>
          {meta.description}
        </span>
      </span>
    </button>
  );
};

const ReceivableRow: React.FC<{
  receivable: Receivable;
  tone: 'pending' | 'overdue' | 'confirmed';
  hideValues: boolean;
}> = ({ receivable, tone, hideValues }) => {
  const dueDate = parseDateSafe(receivable.due_date);
  const realizedDate = parseDateSafe(receivable.realized_at);
  const statusLabel = tone === 'overdue' ? 'Vencida' : tone === 'pending' ? 'Pendente' : 'Realizada';
  const amount = tone === 'confirmed' ? receivable.realized_amount || receivable.expected_amount : receivable.expected_amount;

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{receivable.description}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {statusLabel} {dueDate ? `• ${new Date(dueDate).toLocaleDateString('pt-BR')}` : ''}
          {tone === 'confirmed' && realizedDate ? ` • ${new Date(realizedDate).toLocaleDateString('pt-BR')}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{hideValues ? 'R$ ••••' : formatCurrency(amount)}</p>
        <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${
          tone === 'overdue'
            ? 'text-rose-500 dark:text-rose-300'
            : tone === 'pending'
              ? 'text-amber-500 dark:text-amber-300'
              : 'text-emerald-500 dark:text-emerald-300'
        }`}>
          {statusLabel}
        </p>
      </div>
    </div>
  );
};

const CASHFLOW_TIMEFRAMES = ['7d', '30d', '12m', 'custom'] as const;
type CashflowTimeframe = typeof CASHFLOW_TIMEFRAMES[number];
const REVENUE_SECTIONS = ['realizado', 'previsto', 'pendencias', 'estrategia'] as const;
type RevenueSection = typeof REVENUE_SECTIONS[number];
const PANEL_SURFACE = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const MODAL_SURFACE = 'rounded-2xl bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)] dark:bg-slate-900';
const REVENUE_SECTION_META: Record<RevenueSection, { label: string; description: string }> = {
  realizado: { label: 'Realizado', description: 'Entradas confirmadas e leitura do fluxo atual' },
  previsto: { label: 'Previsto', description: 'Receitas agendadas e valor que ainda pode entrar' },
  pendencias: { label: 'Pendências', description: 'Itens vencidos ou aguardando confirmação' },
  estrategia: { label: 'Estratégia', description: 'Diagnóstico consultivo com fallback de IA' },
};

function parseDateSafe(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

const CashFlow: React.FC<CashFlowProps> = ({ activeWorkspaceId, activeWorkspaceName, transactions, receivables = [], hideValues, theme }) => {
  const [timeframe, setTimeframe] = useState<CashflowTimeframe>('30d');
  const [revenueSection, setRevenueSection] = useState<RevenueSection>('realizado');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [isConsultancyOpen, setIsConsultancyOpen] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [clipboardDiagnostic, setClipboardDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const prevTransactionsSigRef = useRef<string>('');

  const gemini = useRef(new GeminiService());
  const isDark = theme === 'dark';
  const gridColor = FLOW_CHART_UI.grid;
  const reportStorageKey = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return getWorkspaceScopedStorageKey(`flow_report_${today}`, activeWorkspaceId);
  }, [activeWorkspaceId]);

  // Carregar relatório persistente do dia, se existir
  useEffect(() => {
    setReport(null);
    const savedReport = localStorage.getItem(reportStorageKey);
    if (savedReport) {
      try {
        const parsed = JSON.parse(savedReport);
        // Validar shape mínimo
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.actionPlan)) {
          setReport(parsed);
        }
      } catch (error) {
        logWarn('[CashFlow] Failed to parse stored strategic report', {
          error,
          fallback: 'cashflow-parse-stored-report-failed',
        });
      }
    }
  }, [reportStorageKey]);

  // Invalidar relatório quando o recorte financeiro mudar
  useEffect(() => {
    const sig = JSON.stringify(transactions.map(t => t.id + t.amount));
    if (prevTransactionsSigRef.current && prevTransactionsSigRef.current !== sig) {
      setReport(null);
      localStorage.removeItem(reportStorageKey);
    }
    prevTransactionsSigRef.current = sig;
  }, [transactions, reportStorageKey]);


  useEffect(() => {
    if (showCopyToast) {
      const timer = setTimeout(() => setShowCopyToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showCopyToast]);

  const fmt = (val: number) => hideValues ? 'R$ ••••' : formatCurrency(val);

  const filtered = useMemo(
    () => filterTransactionsByTimeframe(transactions, timeframe, dateStart, dateEnd),
    [transactions, timeframe, dateStart, dateEnd]
  );
  const filteredReceivables = useMemo(
    () => filterReceivablesByTimeframe(receivables, timeframe, dateStart, dateEnd),
    [receivables, timeframe, dateStart, dateEnd]
  );

  const reportDiagnostic = report?.diagnostic;
  const reportDiagnosticMessage =
    reportDiagnostic?.message || reportDiagnostic?.suggestion || report?.executiveSummary || '';
  const hasReportDiagnostic = Boolean(reportDiagnostic);

  const totalsByPeriod = useMemo(() => {
    const summary = calculateCashflowSummary(filtered);
    return { expenses: summary.expenses, income: summary.income };
  }, [filtered]);

  const revenueStateSummary = useMemo(
    () => calculateRevenueStateSummary(filtered, filteredReceivables),
    [filtered, filteredReceivables]
  );

  const pendingReceivables = useMemo(
    () => filteredReceivables.filter((receivable) => isReceivablePending(receivable)),
    [filteredReceivables]
  );
  const overdueReceivables = useMemo(
    () => filteredReceivables.filter((receivable) => isReceivableOverdue(receivable)),
    [filteredReceivables]
  );
  const projectedReceivables = useMemo(
    () => [...pendingReceivables, ...overdueReceivables].sort((left, right) => {
      const leftDate = parseDateSafe(left.due_date) ?? 0;
      const rightDate = parseDateSafe(right.due_date) ?? 0;
      return leftDate - rightDate;
    }),
    [pendingReceivables, overdueReceivables]
  );

  const timelineData = useMemo(() => buildCashflowTimeline(filtered), [filtered]);

  const categoryData = useMemo(() => buildExpenseCategoryData(filtered), [filtered]);

  const handleGenerateReport = async () => {
    if (report) {
      setIsConsultancyOpen(true);
      return;
    }
    setIsConsultancyOpen(true);
    setIsGenerating(true);
    try {
      const strategicReport = await gemini.current.generateStrategicReport(filtered);
      const nextReport = strategicReport || {
        executiveSummary: 'IA sem resposta completa',
        actionPlan: ['Revisar entradas confirmadas', 'Separar previsao de caixa disponivel'],
        diagnostic: { kind: 'ai_unavailable', message: 'A IA estratégica não retornou conteúdo para este recorte', suggestion: 'Tente novamente ou ajuste o período analisado' },
      };
      setReport(nextReport);
      localStorage.setItem(reportStorageKey, JSON.stringify(nextReport));
    } catch (e) {
      logWarn('[CashFlow] Failed to generate strategic report', {
        error: e,
        fallback: 'cashflow-generate-strategic-report-failed',
      });
      const fallback = {
        executiveSummary: 'IA sem resposta completa',
        actionPlan: ['A IA estratégica está indisponível no momento', 'A IA estratégica está indisponível no momento'],
        diagnostic: { kind: 'ai_unavailable', message: 'A IA estratégica está indisponível no momento', suggestion: 'Tente novamente mais tarde' },
      };
      setReport(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async (method: 'whatsapp' | 'email' | 'copy') => {
    let shareText = `📊 *RELATORIO DE RECEITAS FLOW* 🌊\n\n`;
    shareText += `📅 *Período:* ${timeframe === 'custom' ? `${dateStart} a ${dateEnd}` : timeframe.toUpperCase()}\n`;
    shareText += `🟢 *Entradas:* ${formatCurrency(totalsByPeriod.income)}\n`;
    shareText += `🔴 *Saídas:* ${formatCurrency(totalsByPeriod.expenses)}\n`;
    shareText += `💰 *Saldo Líquido:* ${formatCurrency(totalsByPeriod.income - totalsByPeriod.expenses)}\n\n`;

    if (report) {
      shareText += `🧠 *Prioridade Flow - Diagnóstico:* \n${report.executiveSummary || ''}\n\n`;
      if (report.diagnostic) {
        const diagnosticMessage = report.diagnostic.message || report.diagnostic.suggestion || report.executiveSummary || '';
        shareText += `⚠️ *Diagnóstico técnico:* \n${diagnosticMessage}\n\n`;
        if (report.diagnostic.suggestion) {
          shareText += `➡️ *Próximo passo:* ${report.diagnostic.suggestion}\n\n`;
        }
      }
      if (report.actionPlan && Array.isArray(report.actionPlan)) {
        shareText += `💡 *Plano de Ação:* \n${report.actionPlan.map((s: string) => `✅ ${s}`).join('\n')}`;
      }
    }

    if (method === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
      setIsShareModalOpen(false);
    } else if (method === 'email') {
      window.location.href = `mailto:?subject=Relatorio de Receitas Flow&body=${encodeURIComponent(shareText)}`;
      setIsShareModalOpen(false);
    } else if (method === 'copy') {
      try {
        await navigator.clipboard.writeText(shareText);
        setClipboardDiagnostic(null);
        setShowCopyToast(true);
        setIsShareModalOpen(false);
      } catch (error) {
        logWarn('[CashFlow] Failed to copy summary', {
          error,
          fallback: 'cashflow-copy-summary-failed',
        });
        setClipboardDiagnostic({
          title: 'Falha ao copiar resumo',
          message: 'O navegador bloqueou a copia do texto do fluxo.',
          suggestion: 'Use o envio por WhatsApp ou E-mail, ou copie manualmente o conteudo.',
        });
      }
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-700 pb-20 overflow-visible relative">
      <div className={`${PANEL_SURFACE} flex items-center justify-between gap-4 p-5 shrink-0`}>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight leading-none text-slate-900 dark:text-white">Receitas</h2>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Workspace: {activeWorkspaceName || 'Carregando workspace'}
          </p>
          <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Realizado, previsto e decisão</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <TrendingUp size={20} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <div role="tablist" aria-label="Período do fluxo de receitas" className="flex flex-1 bg-white dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto no-scrollbar">
            {CASHFLOW_TIMEFRAMES.map(t => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={timeframe === t}
                aria-label={
                  t === '7d' ? 'Últimos 7 dias' :
                  t === '30d' ? 'Últimos 30 dias' :
                  t === '12m' ? 'Últimos 12 meses' :
                  'Período customizado'
                }
                onClick={() => setTimeframe(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-[0.16em] transition-all whitespace-nowrap flex-1 ${timeframe === t ? 'bg-slate-900 text-white shadow-md dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {t === 'custom' ? 'Calendário' : t}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsShareModalOpen(true)}
            aria-label="Abrir compartilhamento do fluxo"
            className="p-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <Share2 size={18} />
          </button>
        </div>

        {timeframe === 'custom' && (
          <div className="grid grid-cols-2 gap-3 px-1 animate-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] ml-1">Data de Início</label>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] ml-1">Data de Fim</label>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StateMetricCard label="Realizado" value={fmt(revenueStateSummary.confirmed)} tone="confirmed" />
        <StateMetricCard label="Previsto" value={fmt(revenueStateSummary.projected)} tone="projected" />
        <StateMetricCard label="Pendente" value={fmt(revenueStateSummary.pending)} tone="pending" />
        <StateMetricCard label="Vencido" value={fmt(revenueStateSummary.overdue)} tone="overdue" />
      </div>

      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label="Seções do fluxo de receitas" className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <RevenueSectionButton section="realizado" active={revenueSection === 'realizado'} onClick={setRevenueSection} icon={<CheckCircle2 size={16} />} />
          <RevenueSectionButton section="previsto" active={revenueSection === 'previsto'} onClick={setRevenueSection} icon={<Calendar size={16} />} />
          <RevenueSectionButton section="pendencias" active={revenueSection === 'pendencias'} onClick={setRevenueSection} icon={<AlertTriangle size={16} />} />
          <RevenueSectionButton section="estrategia" active={revenueSection === 'estrategia'} onClick={setRevenueSection} icon={<BrainCircuit size={16} />} />
        </div>

        {revenueSection === 'realizado' && (
          <>
            <div role="tabpanel" aria-label="Receitas realizadas" className={`${PANEL_SURFACE} p-6 overflow-hidden min-h-[220px]`}>
              <div className="flex items-center justify-between mb-4 gap-4">
                <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] flex items-center gap-2"><Calendar size={14} /> Receita realizada</h3>
                <div className="flex flex-wrap justify-end gap-4">
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400"><span>Entradas</span>: {fmt(totalsByPeriod.income)}</span>
                  <span className="text-sm font-semibold text-rose-500 dark:text-rose-400"><span>Saídas</span>: {fmt(totalsByPeriod.expenses)}</span>
                </div>
              </div>
              <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220} minWidth={0}>
                    <AreaChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip hideValues={hideValues} />} />
                      <Area type="monotone" name="Entradas" dataKey="incoming" stroke={FLOW_CHART_COLORS.income} fill={FLOW_CHART_COLORS.income} fillOpacity={0.05} strokeWidth={2.5} />
                      <Area type="monotone" name="Saídas" dataKey="outgoing" stroke={FLOW_CHART_COLORS.expenses} fill={FLOW_CHART_COLORS.expenses} fillOpacity={0.05} strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState
                    title="Sem movimento neste recorte"
                    message="Lance uma receita ou despesa em Transações para abrir a linha do tempo."
                    hint="A primeira movimentação já preenche este painel."
                    icon={<Calendar size={22} />}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`${PANEL_SURFACE} p-6 overflow-hidden min-h-[220px]`}>
                <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4 flex items-center gap-2"><PieIcon size={14} /> Composição</h3>
                <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220} minWidth={0}>
                      <PieChart>
                        <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                          {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip hideValues={hideValues} isPercentage total={totalsByPeriod.expenses} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState
                      title="Sem despesas para segmentar"
                      message="Quando houver despesas neste período, a composição aparece por categoria."
                      hint="A primeira despesa já destrava este painel."
                      icon={<PieIcon size={22} />}
                    />
                  )}
                </div>
              </div>

              <div className={`${PANEL_SURFACE} p-6 overflow-hidden min-h-[220px]`}>
                <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4 flex items-center gap-2"><Target size={14} /> Ranking</h3>
                <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220} minWidth={0}>
                      <BarChart data={categoryData} layout="vertical" margin={{ left: -30, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: FLOW_CHART_UI.axis }} />
                        <Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.05)' }} content={<CustomTooltip hideValues={hideValues} isPercentage total={totalsByPeriod.expenses} />} />
                        <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={16}>
                          {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState
                      title="Sem ranking ainda"
                      message="A lista de categorias surge quando existirem despesas no recorte atual."
                      hint="Lance a primeira despesa no app para gerar o ranking."
                      icon={<Target size={22} />}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {revenueSection === 'previsto' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className={`${PANEL_SURFACE} p-6 overflow-hidden`}>
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] flex items-center gap-2"><Calendar size={14} /> Previsão de receita</h3>
                  <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Entradas confirmadas, previstas e o que ainda pode entrar neste recorte.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StateMetricCard label="Confirmado" value={fmt(revenueStateSummary.confirmed)} tone="confirmed" />
                <StateMetricCard label="Previsto" value={fmt(revenueStateSummary.projected)} tone="projected" />
                <StateMetricCard label="Base futura" value={fmt(revenueStateSummary.pending + revenueStateSummary.overdue)} tone="pending" />
              </div>
              <div className="mt-6 h-[220px] w-full" style={{ minHeight: '220px' }}>
                {projectedReceivables.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220} minWidth={0}>
                    <BarChart
                      data={[
                        { name: 'Confirmado', value: revenueStateSummary.confirmed },
                        { name: 'Pendente', value: revenueStateSummary.pending },
                        { name: 'Vencido', value: revenueStateSummary.overdue },
                      ]}
                      margin={{ left: 8, right: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600, fill: FLOW_CHART_UI.axis }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip hideValues={hideValues} />} />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={56}>
                        <Cell fill={FLOW_CHART_COLORS.income} />
                        <Cell fill={FLOW_CHART_COLORS.balance} />
                        <Cell fill={FLOW_CHART_COLORS.expenses} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState
                    title="Sem previsão no recorte"
                    message="Quando houver recebíveis pendentes ou vencidos, este gráfico mostra o potencial de entrada."
                    hint="Use o próximo recorte para acompanhar o pipeline."
                    icon={<Calendar size={22} />}
                  />
                )}
              </div>
            </div>

            <div className={`${PANEL_SURFACE} p-6 overflow-hidden`}>
              <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4 flex items-center gap-2"><CheckCircle2 size={14} /> Próximos recebíveis</h3>
              <div className="space-y-3">
                {projectedReceivables.length > 0 ? (
                  projectedReceivables.slice(0, 6).map((receivable) => (
                    <ReceivableRow
                      key={receivable.id}
                      receivable={receivable}
                      tone={isReceivableOverdue(receivable) ? 'overdue' : 'pending'}
                      hideValues={hideValues}
                    />
                  ))
                ) : (
                  <EmptyChartState
                    title="Nenhum recebível previsto"
                    message="Não há pendências ou vencimentos dentro do período filtrado."
                    hint="A previsão aparece quando surgirem lançamentos futuros."
                    icon={<CheckCircle2 size={22} />}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {revenueSection === 'pendencias' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className={`${PANEL_SURFACE} p-6 overflow-hidden`}>
              <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Pendências em aberto</h3>
              <div className="space-y-3">
                {pendingReceivables.length > 0 ? (
                  pendingReceivables.map((receivable) => (
                    <ReceivableRow key={receivable.id} receivable={receivable} tone="pending" hideValues={hideValues} />
                  ))
                ) : (
                  <EmptyChartState
                    title="Sem pendências abertas"
                    message="Recebíveis ainda dentro do prazo aparecem aqui para monitoramento."
                    hint="A fila fica vazia quando tudo já foi realizado ou não há previsões."
                    icon={<CheckCircle2 size={22} />}
                  />
                )}
              </div>
            </div>

            <div className={`${PANEL_SURFACE} p-6 overflow-hidden`}>
              <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Vencidos</h3>
              <div className="space-y-3">
                {overdueReceivables.length > 0 ? (
                  overdueReceivables.map((receivable) => (
                    <ReceivableRow key={receivable.id} receivable={receivable} tone="overdue" hideValues={hideValues} />
                  ))
                ) : (
                  <EmptyChartState
                    title="Sem vencidos"
                    message="Quando um recebível passa do prazo, ele sobe para esta lista sem alterar os cálculos existentes."
                    hint="A ausência aqui é um sinal operacional útil."
                    icon={<AlertTriangle size={22} />}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {revenueSection === 'estrategia' && (
          <div className="w-full overflow-visible py-2">
            <div className={`${PANEL_SURFACE} relative overflow-visible p-6`}>
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Target size={28} />
                </div>
                <div>
                  <h4 className="text-base font-semibold tracking-tight uppercase text-slate-500 dark:text-slate-400">Próximo passo financeiro</h4>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">Diagnóstico curto para decidir o que fazer agora.</p>
                </div>
              </div>
              {report && (
                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Resumo estratégico salvo</p>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">{report.executiveSummary}</p>
                  {report.actionPlan && Array.isArray(report.actionPlan) && (
                    <ul className="mt-4 space-y-2">
                      {report.actionPlan.map((step: string, index: number) => (
                        <li key={`${step}-${index}`} className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <button
                onClick={handleGenerateReport}
                className="group relative z-10 mt-6 flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-slate-900 py-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <BrainCircuit size={20} className="group-hover:rotate-12 transition-transform" /> {report ? 'Abrir diagnóstico' : 'Gerar diagnóstico'}
              </button>
            </div>
          </div>
        )}
      </div>

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div role="dialog" aria-modal="true" aria-labelledby="cashflow-share-title" aria-describedby="cashflow-share-description" className={`${MODAL_SURFACE} w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95`}>
            <div className="flex justify-between items-center">
              <h3 id="cashflow-share-title" className="text-xl font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Exportar Receitas</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="p-1 text-slate-400"><X size={20} /></button>
            </div>

            <div id="cashflow-share-description" className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
               <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-[0.16em] mb-2">Resumo Incluído</p>
               <div className="space-y-1">
                 <p className="text-xs font-medium text-slate-600 dark:text-slate-300">• Dados de Entradas/Saídas</p>
                 <p className="text-xs font-medium text-slate-600 dark:text-slate-300">• Divisão por Categorias</p>
                 {report && <p className="text-xs font-medium text-slate-600 dark:text-slate-300">• Prioridade Flow (Análise IA)</p>}
               </div>
            </div>

            {clipboardDiagnostic && (
              <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">{clipboardDiagnostic.title}</p>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-100">{clipboardDiagnostic.message}</p>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Próximo passo: {clipboardDiagnostic.suggestion}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => void handleShare('whatsapp')} className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all">
                <MessageCircle className="text-emerald-500" size={24} />
                <span className="text-sm font-semibold text-emerald-600 uppercase tracking-[0.12em]">WhatsApp</span>
              </button>
              <button onClick={() => void handleShare('copy')} aria-label="Copiar resumo do fluxo" className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all">
                <FileText className="text-slate-500" size={24} />
                <span className="text-sm font-semibold text-slate-600 uppercase tracking-[0.12em]">Copiar Texto</span>
              </button>
              <button onClick={() => void handleShare('email')} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all col-span-2">
                <Mail className="text-slate-500" size={24} />
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">Enviar por E-mail</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showCopyToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[400] transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-semibold text-sm uppercase tracking-[0.16em] border border-white/20">
            <Check size={16} strokeWidth={3} /> Copiado para a área de transferência!
          </div>
        </div>
      )}

      {isConsultancyOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cashflow-consultancy-title" className={`${MODAL_SURFACE} w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95`}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 id="cashflow-consultancy-title" className="text-xl font-semibold text-slate-800 dark:text-white tracking-tight">Estratégia Flow</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Diagnóstico consultivo do recorte atual</p>
              </div>
              <button onClick={() => setIsConsultancyOpen(false)} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-full text-slate-400"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 no-scrollbar">
              {isGenerating ? (
                <div className="py-24 flex flex-col items-center gap-5 text-center text-slate-600 font-semibold uppercase tracking-[0.16em]">
                  <Loader2 size={40} className="animate-spin" strokeWidth={3} />
                  <p className="text-xs">Auditando movimentações...</p>
                </div>
              ) : report && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  {hasReportDiagnostic && (
                    <div className="p-5 rounded-3xl border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold uppercase tracking-[0.16em]">IA sem resposta completa</h4>
                          <p className="text-sm font-medium leading-relaxed">{reportDiagnosticMessage}</p>
                          {reportDiagnostic?.suggestion && (
                            <p className="text-sm font-semibold uppercase tracking-[0.16em] opacity-90">
                              Próximo passo: {reportDiagnostic.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-[0.16em] flex items-center gap-2"><Target size={14}/> Diagnóstico Executivo</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{report.executiveSummary}</p>
                  </div>
                  <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-sm dark:bg-slate-100 dark:text-slate-900">
                    <h4 className="text-sm font-semibold uppercase mb-4 tracking-[0.16em] flex items-center gap-2"><Lightbulb size={16}/> Plano de Ação</h4>
                    <ul className="space-y-3">
                      {report.actionPlan && Array.isArray(report.actionPlan) && report.actionPlan.map((step: string, i: number) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 dark:bg-slate-900/10">{i+1}</span>
                          <span className="text-sm font-medium leading-tight">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3">
              <button onClick={() => setIsConsultancyOpen(false)} className="flex-1 py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-semibold text-sm uppercase tracking-[0.16em] active:scale-95">Sair</button>
              <button onClick={() => handleShare('whatsapp')} className="flex-1 py-4 bg-slate-100 dark:bg-slate-100 text-slate-900 rounded-2xl font-semibold text-sm uppercase tracking-[0.16em] active:scale-95 flex items-center justify-center gap-2">
                <MessageCircle size={16} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashFlow;








