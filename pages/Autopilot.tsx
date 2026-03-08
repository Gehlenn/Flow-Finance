import React, { useMemo, useState, useEffect } from 'react';
import { Transaction } from '../types';
import { Account } from '../models/Account';
import { runFinancialAutopilot, AutopilotAction, learnAutopilotPatterns } from '../services/ai/financialAutopilot';
import { runAIPipelineSync } from '../services/ai/aiOrchestrator';
import {
  Zap, AlertTriangle, Lightbulb, TrendingUp, ShieldCheck,
  ChevronRight, RefreshCw, CheckCircle2, Info,
  Sparkles, Bot, Settings2
} from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AutopilotProps {
  transactions: Transaction[];
  accounts: Account[];
  userId?: string;
  hideValues: boolean;
  onNavigate?: (tab: string) => void;
}

// ─── Styles map ───────────────────────────────────────────────────────────────

const TYPE_META: Record<AutopilotAction['type'], {
  icon: React.ReactNode;
  bg: string;
  border: string;
  iconBg: string;
  label: string;
}> = {
  warning: {
    icon: <AlertTriangle size={16} />,
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-100 dark:border-rose-500/20',
    iconBg: 'bg-rose-100 dark:bg-rose-500/20 text-rose-500',
    label: 'Alerta',
  },
  suggestion: {
    icon: <Lightbulb size={16} />,
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-100 dark:border-amber-500/20',
    iconBg: 'bg-amber-100 dark:bg-amber-500/20 text-amber-500',
    label: 'Sugestão',
  },
  optimization: {
    icon: <TrendingUp size={16} />,
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    border: 'border-indigo-100 dark:border-indigo-500/20',
    iconBg: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-500',
    label: 'Otimização',
  },
  insight: {
    icon: <Sparkles size={16} />,
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    border: 'border-violet-100 dark:border-violet-500/20',
    iconBg: 'bg-violet-100 dark:bg-violet-500/20 text-violet-500',
    label: 'Insight',
  },
};

const SEV_BADGE: Record<string, string> = {
  high:   'bg-rose-100 dark:bg-rose-500/20 text-rose-600',
  medium: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600',
  low:    'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300',
};
const SEV_LABEL: Record<string, string> = { high: 'Alto', medium: 'Médio', low: 'Baixo' };

// ─── Action Card ──────────────────────────────────────────────────────────────

const ActionCard: React.FC<{ action: AutopilotAction; onDismiss: (id: string) => void }> = ({ action, onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const meta = TYPE_META[action.type];

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => onDismiss(action.id), 300);
  };

  return (
    <div className={`${meta.bg} border ${meta.border} rounded-[1.8rem] p-5 flex gap-4 items-start transition-all duration-300 ${dismissed ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-black text-slate-900 dark:text-white text-sm">{action.title}</p>
          {action.severity && (
            <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${SEV_BADGE[action.severity]}`}>
              {SEV_LABEL[action.severity]}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 font-bold leading-relaxed">{action.description}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.iconBg}`}>
            {meta.label}
          </span>
          <button
            onClick={handleDismiss}
            className="ml-auto text-[8px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-widest flex items-center gap-1 transition-colors"
          >
            <CheckCircle2 size={10} /> Dispensar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Section ──────────────────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  actions: AutopilotAction[];
  onDismiss: (id: string) => void;
  accent: string;
}> = ({ title, icon, actions, onDismiss, accent }) => {
  if (actions.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className={accent}>{icon}</span>
        <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}</h3>
        <span className={`ml-auto text-[8px] font-black px-2 py-0.5 rounded-full ${accent.replace('text-', 'bg-').replace('-500', '-50')} ${accent}`}>
          {actions.length}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {actions.map(a => <ActionCard key={a.id} action={a} onDismiss={onDismiss} />)}
      </div>
    </section>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Autopilot: React.FC<AutopilotProps> = ({ transactions, accounts, userId = 'local', hideValues }) => {
  const pipeline = useMemo(() => runAIPipelineSync(transactions, userId), [transactions, userId]);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const allActions = useMemo(() => {
    return runFinancialAutopilot(
      accounts,
      transactions,
      pipeline.financial_state.cashflow_prediction,
      pipeline.insights
    );
  }, [accounts, transactions, pipeline.financial_state.cashflow_prediction, pipeline.insights]);

  // run learning in background when inputs change
  useEffect(() => {
    learnAutopilotPatterns(userId, accounts, transactions, pipeline.financial_state.cashflow_prediction)
      .catch((e) => {
        console.error('Falha ao aprender padrões do Autopilot:', e);
      });
  }, [userId, accounts, transactions, pipeline.financial_state.cashflow_prediction, learnAutopilotPatterns]);

  const visible = useMemo(
    () => allActions.filter(a => !dismissed.has(a.id)),
    [allActions, dismissed]
  );

  const handleDismiss = (id: string) => setDismissed(prev => new Set([...prev, id]));

  const warnings     = visible.filter(a => a.type === 'warning');
  const suggestions  = visible.filter(a => a.type === 'suggestion');
  const optimizations = visible.filter(a => a.type === 'optimization');
  const insights     = visible.filter(a => a.type === 'insight');

  const isEmpty = transactions.filter(t => !t.generated).length === 0;
  const allDismissed = visible.length === 0 && allActions.length > 0;

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-700 pb-24">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Autopilot</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Análise Financeira Proativa</p>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={() => { setDismissed(new Set()); setRefreshKey(k => k + 1); }}
            className="w-9 h-9 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            title="Atualizar análise"
          >
            <RefreshCw size={15} />
          </button>
          <div className="w-9 h-9 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white">
            <Bot size={18} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-white dark:bg-slate-800 rounded-[1.8rem] p-4 border border-slate-100 dark:border-slate-700 flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full shrink-0 ${warnings.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
        <div className="flex-1">
          <p className="text-xs font-black text-slate-900 dark:text-white">
            {warnings.length > 0
              ? `${warnings.length} alerta${warnings.length > 1 ? 's' : ''} ativo${warnings.length > 1 ? 's' : ''}`
              : 'Tudo sob controle'}
          </p>
          <p className="text-[8px] text-slate-400 font-bold">
            {visible.length} ação{visible.length !== 1 ? 'ões' : ''} · Atualizado agora
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl">
          <Settings2 size={10} className="text-indigo-500" />
          <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Autopilot On</span>
        </div>
      </div>

      {/* Empty / No data */}
      {isEmpty && (
        <div className="flex flex-col items-center py-16 gap-4 text-slate-300 dark:text-slate-600">
          <Bot size={44} />
          <p className="text-[10px] font-black uppercase tracking-widest text-center">
            Adicione transações para ativar o autopilot
          </p>
        </div>
      )}

      {/* All dismissed */}
      {!isEmpty && allDismissed && (
        <div className="flex flex-col items-center py-12 gap-3">
          <CheckCircle2 size={40} className="text-emerald-400" />
          <p className="text-sm font-black text-slate-700 dark:text-white">Todas as ações dispensadas!</p>
          <button
            onClick={() => { setDismissed(new Set()); setRefreshKey(k => k + 1); }}
            className="mt-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all"
          >
            <RefreshCw size={12} /> Nova Análise
          </button>
        </div>
      )}

      {!isEmpty && !allDismissed && (
        <>
          {/* Sections */}
          <Section
            title="Alertas"
            icon={<AlertTriangle size={15} />}
            actions={warnings}
            onDismiss={handleDismiss}
            accent="text-rose-500"
          />
          <Section
            title="Sugestões"
            icon={<Lightbulb size={15} />}
            actions={suggestions}
            onDismiss={handleDismiss}
            accent="text-amber-500"
          />
          <Section
            title="Otimizações"
            icon={<TrendingUp size={15} />}
            actions={optimizations}
            onDismiss={handleDismiss}
            accent="text-indigo-500"
          />
          <Section
            title="Insights"
            icon={<Sparkles size={15} />}
            actions={insights}
            onDismiss={handleDismiss}
            accent="text-violet-500"
          />

          {/* Safety disclaimer */}
          <div className="flex items-start gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
            <ShieldCheck size={13} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[8px] text-slate-400 font-bold leading-relaxed">
              O Autopilot apenas sugere ações. Nenhum dado financeiro é alterado automaticamente. Todas as decisões são suas.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default Autopilot;
