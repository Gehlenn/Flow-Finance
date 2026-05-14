
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import { formatCurrency } from '../utils/helpers';
import { GeminiService } from '../services/geminiService';
import { getWorkspaceScopedStorageKey } from '../src/utils/workspaceStorage';
import {
  buildCashflowTimeline,
  buildExpenseCategoryData,
  filterTransactionsByTimeframe,
} from '../src/engines/finance/analyticsEngine';
import { calculateCashflowSummary } from '../src/engines/finance/cashflowEngine';
import { logWarn } from '../src/utils/logger';
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
  hideValues: boolean;
  theme: 'light' | 'dark';
}

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#334155'];

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
            <span className="text-[11px] font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-[0.12em]">
              {percent}%
            </span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

interface RevenueStateSummary {
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

function calculateRevenueStateSummary(transactions: Transaction[], referenceDate: Date = new Date()): RevenueStateSummary {
  const incomeTransactions = transactions.filter((transaction) => transaction.type === TransactionType.RECEITA);

  const summary = incomeTransactions.reduce((accumulator, transaction) => {
    const state = classifyRevenueState(transaction, referenceDate);
    if (state === 'pending') {
      accumulator.pending += transaction.amount;
    } else if (state === 'overdue') {
      accumulator.overdue += transaction.amount;
    } else {
      accumulator.confirmed += transaction.amount;
    }
    return accumulator;
  }, { confirmed: 0, pending: 0, overdue: 0 });

  return {
    confirmed: summary.confirmed,
    pending: summary.pending,
    overdue: summary.overdue,
    projected: summary.pending + summary.overdue,
  };
}

const STATE_TONE_CLASS_MAP: Record<'confirmed' | 'projected' | 'pending' | 'overdue', string> = {
  confirmed: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300',
  projected: 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300',
  pending: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300',
  overdue: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300',
};

const StateMetricCard: React.FC<{ label: string; value: string; tone: 'confirmed' | 'projected' | 'pending' | 'overdue' }> = ({ label, value, tone }) => (
  <div className={`rounded-2xl border px-4 py-3 ${STATE_TONE_CLASS_MAP[tone]}`}>
    <p className="text-sm font-semibold uppercase tracking-[0.16em] opacity-80">{label}</p>
    <p className="mt-1 text-xl font-medium tracking-tight">{value}</p>
  </div>
);
const CashFlow: React.FC<CashFlowProps> = ({ activeWorkspaceId, activeWorkspaceName, transactions, hideValues, theme }) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '12m' | 'custom'>('30d');
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
  const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(148, 163, 184, 0.1)";
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

  const reportDiagnostic = report?.diagnostic;
  const reportDiagnosticMessage =
    reportDiagnostic?.message || reportDiagnostic?.suggestion || report?.executiveSummary || '';
  const hasReportDiagnostic = Boolean(reportDiagnostic);

  const totalsByPeriod = useMemo(() => {
    const summary = calculateCashflowSummary(filtered);
    return { expenses: summary.expenses, income: summary.income };
  }, [filtered]);

  const revenueStateSummary = useMemo(() => calculateRevenueStateSummary(filtered), [filtered]);

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
      setReport(strategicReport);
      localStorage.setItem(reportStorageKey, JSON.stringify(strategicReport));
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
      <div className="bg-gradient-to-r from-indigo-600 to-sky-500 p-6 rounded-3xl flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight leading-none">Receitas</h2>
          <p className="text-sm font-semibold text-white/80 uppercase tracking-[0.16em] mt-2">
            Workspace: {activeWorkspaceName || 'Carregando workspace'}
          </p>
          <p className="text-sm font-semibold text-white/70 uppercase tracking-[0.16em] mt-1.5">Realizado, previsto e decisão</p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white">
          <TrendingUp size={22} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex flex-1 bg-white dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto no-scrollbar">
            {['7d', '30d', '12m', 'custom'].map(t => (
              <button key={t} onClick={() => setTimeframe(t as any)} className={`px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-[0.16em] transition-all whitespace-nowrap flex-1 ${timeframe === t ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-500'}`}>
                {t === 'custom' ? 'Calendário' : t}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsShareModalOpen(true)}
            aria-label="Abrir compartilhamento do fluxo"
            className="p-3 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-105 active:scale-95 transition-all"
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

      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.3)] overflow-hidden min-h-[220px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] flex items-center gap-2"><Calendar size={14} /> Receita realizada</h3>
          <div className="flex gap-4">
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400"><span>Entradas</span>: {fmt(totalsByPeriod.income)}</span>
            <span className="text-sm font-semibold text-rose-500 dark:text-rose-400"><span>Saídas</span>: {fmt(totalsByPeriod.expenses)}</span>
          </div>
        </div>
        <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <AreaChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip hideValues={hideValues} />} />
              <Area type="monotone" name="Entradas" dataKey="incoming" stroke="#10b981" fill="#10b981" fillOpacity={0.05} strokeWidth={2.5} />
              <Area type="monotone" name="Saídas" dataKey="outgoing" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.05} strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.3)] overflow-hidden min-h-[220px]">
          <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4 flex items-center gap-2"><PieIcon size={14} /> Composição</h3>
          <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <PieChart>
                <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip hideValues={hideValues} isPercentage total={totalsByPeriod.expenses} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.3)] overflow-hidden min-h-[220px]">
          <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4 flex items-center gap-2"><Target size={14} /> Ranking</h3>
          <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: -30, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: isDark ? '#64748b' : '#94a3b8' }} />
                <Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.05)' }} content={<CustomTooltip hideValues={hideValues} isPercentage total={totalsByPeriod.expenses} />} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={16}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="w-full overflow-visible py-4">
        <div className="bg-slate-900 rounded-3xl p-8 flex flex-col justify-between border border-indigo-500/10 shadow-[0_30px_60px_-15px_rgba(79,70,229,0.3)] animate-pulse-wiggle relative overflow-visible">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.1)_0%,_transparent_60%)] pointer-events-none rounded-3xl"></div>
          <div className="flex items-start gap-5 relative z-10">
             <div className="w-14 h-14 bg-indigo-600/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-400 shrink-0 shadow-inner border border-indigo-500/30">
               <Target size={28} />
             </div>
             <div>
               <h4 className="text-base font-semibold tracking-tight uppercase text-indigo-300">Próximo passo financeiro</h4>
               <p className="text-sm text-slate-200 font-medium leading-relaxed mt-1.5 opacity-90">Diagnóstico curto para decidir o que fazer agora.</p>
             </div>
          </div>
          <button 
            onClick={handleGenerateReport}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-semibold text-sm uppercase tracking-[0.16em] shadow-2xl flex items-center justify-center gap-3 mt-8 active:scale-95 transition-all relative z-10 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <BrainCircuit size={20} className="group-hover:rotate-12 transition-transform" /> {report ? 'Abrir diagnóstico' : 'Gerar diagnóstico'}
          </button>
        </div>
      </div>

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Exportar Receitas</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="p-1 text-slate-400"><X size={20} /></button>
            </div>
            
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
               <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.16em] mb-2">Resumo Incluído</p>
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
              <button onClick={() => void handleShare('copy')} aria-label="Copiar resumo do fluxo" className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all">
                <FileText className="text-indigo-500" size={24} />
                <span className="text-sm font-semibold text-indigo-600 uppercase tracking-[0.12em]">Copiar Texto</span>
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
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Estratégia Flow</h3>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] mt-1">Auditado por Inteligência Artificial</p>
              </div>
              <button onClick={() => setIsConsultancyOpen(false)} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
              {isGenerating ? (
                <div className="py-24 flex flex-col items-center gap-5 text-center text-indigo-600 font-semibold uppercase tracking-[0.16em]">
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
                    <h4 className="text-sm font-semibold text-indigo-600 mb-2 uppercase tracking-[0.16em] flex items-center gap-2"><Target size={14}/> Diagnóstico Executivo</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{report.executiveSummary}</p>
                  </div>
                  <div className="p-6 bg-indigo-600 text-white rounded-3xl shadow-xl">
                    <h4 className="text-sm font-semibold uppercase mb-4 tracking-[0.16em] flex items-center gap-2"><Lightbulb size={16}/> Plano de Ação</h4>
                    <ul className="space-y-3">
                      {report.actionPlan && Array.isArray(report.actionPlan) && report.actionPlan.map((step: string, i: number) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0">{i+1}</span>
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
              <button onClick={() => handleShare('whatsapp')} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-sm uppercase tracking-[0.16em] active:scale-95 flex items-center justify-center gap-2">
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








