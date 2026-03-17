import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { runAIPipelineSync } from '../src/ai/aiOrchestrator';
import { AIInsight } from '../src/ai/insightGenerator';
import { FinancialRiskAlert } from '../src/ai/riskAnalyzer';
import { buildProductFinancialIntelligence } from '../src/app/productFinancialIntelligence';
import {
  Sparkles, TrendingUp, TrendingDown, ShieldAlert,
  Lightbulb, PiggyBank, AlertTriangle, CheckCircle2,
  BarChart3, Brain, Zap, Info, Activity
} from 'lucide-react';

interface InsightsProps {
  transactions: Transaction[];
  userId?: string;
  hideValues: boolean;
}

// ─── Severity styles ─────────────────────────────────────────────────────────

const SEVERITY_STYLES = {
  low:    { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-100 dark:border-emerald-500/20', icon: 'text-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-500/10',    border: 'border-amber-100 dark:border-amber-500/20',    icon: 'text-amber-500',   badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' },
  high:   { bg: 'bg-rose-50 dark:bg-rose-500/10',      border: 'border-rose-100 dark:border-rose-500/20',      icon: 'text-rose-500',    badge: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600' },
};

const SEVERITY_LABEL = { low: 'Baixo', medium: 'Médio', high: 'Alto' };

const INSIGHT_ICON: Record<string, React.ReactNode> = {
  spending: <TrendingUp size={16} />,
  saving:   <PiggyBank size={16} />,
  warning:  <AlertTriangle size={16} />,
};

const RISK_ICON: Record<string, React.ReactNode> = {
  low_balance:           <TrendingDown size={16} />,
  spending_acceleration: <Zap size={16} />,
  negative_forecast:     <ShieldAlert size={16} />,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const InsightCard: React.FC<{ insight: AIInsight }> = ({ insight }) => {
  const s = SEVERITY_STYLES[insight.severity ?? 'low'];
  return (
    <div className={`${s.bg} border ${s.border} rounded-[1.8rem] p-5 flex gap-4 items-start`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.icon}`}>
        {INSIGHT_ICON[insight.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-white leading-snug">{insight.message}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${s.badge}`}>
            {SEVERITY_LABEL[insight.severity ?? 'low']}
          </span>
          <span className="text-[8px] text-slate-400 font-bold capitalize">{insight.type}</span>
        </div>
      </div>
    </div>
  );
};

const RiskCard: React.FC<{ alert: FinancialRiskAlert }> = ({ alert }) => {
  const s = SEVERITY_STYLES[alert.severity];
  return (
    <div className={`${s.bg} border ${s.border} rounded-[1.8rem] p-5 flex gap-4 items-start`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.icon}`}>
        {RISK_ICON[alert.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-white leading-snug">{alert.message}</p>
        <span className={`inline-block mt-2 text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${s.badge}`}>
          Risco {SEVERITY_LABEL[alert.severity]}
        </span>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const HEALTH_STYLES: Record<string, { bg: string; text: string; bar: string }> = {
  crítico:   { bg: 'bg-rose-500',    text: 'text-rose-500',    bar: 'bg-rose-500' },
  atenção:   { bg: 'bg-amber-500',   text: 'text-amber-500',   bar: 'bg-amber-500' },
  estável:   { bg: 'bg-slate-500',   text: 'text-slate-500',   bar: 'bg-slate-400' },
  saudável:  { bg: 'bg-indigo-500',  text: 'text-indigo-500',  bar: 'bg-indigo-500' },
  excelente: { bg: 'bg-emerald-500', text: 'text-emerald-500', bar: 'bg-emerald-500' },
};

const Insights: React.FC<InsightsProps> = ({ transactions, userId = 'local', hideValues }) => {
  // Pipeline completo via orchestrator (síncrono)
  const pipeline = useMemo(
    () => runAIPipelineSync(transactions, userId),
    [transactions, userId]
  );
  const intelligence = useMemo(
    () => buildProductFinancialIntelligence({ userId, transactions }),
    [transactions, userId]
  );

  const { financial_state, profile: profileResult, risks, insights, health_score, health_label } = pipeline;
  const prediction = intelligence.context.cashflowForecast;

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const isEmpty = transactions.filter(t => !t.generated).length === 0;
  const hs = HEALTH_STYLES[health_label];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700 pb-24">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Insights</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Análise Financeira com IA</p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
          <Brain size={22} />
        </div>
      </div>

      {isEmpty && (
        <div className="flex flex-col items-center py-16 gap-4 text-slate-300 dark:text-slate-600">
          <Sparkles size={40} />
          <p className="text-[10px] font-black uppercase tracking-widest text-center">
            Adicione transações para ver seus insights
          </p>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* ── Health Score ────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className={hs.text} />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saúde Financeira</p>
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full text-white ${hs.bg}`}>
                {health_label}
              </span>
            </div>
            <div className="flex items-end gap-3 mb-3">
              <p className={`text-5xl font-black leading-none ${hs.text}`}>{health_score}</p>
              <p className="text-slate-400 font-black text-lg mb-1">/100</p>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${hs.bar} rounded-full transition-all duration-1000`}
                style={{ width: `${health_score}%` }}
              />
            </div>
            <p className="text-[8px] text-slate-400 mt-2">
              {pipeline.processing_ms}ms · pipeline v{pipeline.computed_at ? '0.3' : '—'}
            </p>
          </div>

          {/* ── Projeção Rápida ─────────────────────────────────────────── */}
          <div className="bg-slate-900 dark:bg-slate-800 rounded-[2rem] p-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Hoje', value: prediction.currentBalance },
              { label: '7 dias', value: prediction.in7Days },
              { label: '30 dias', value: prediction.in30Days },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1 items-center text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <p className={`text-sm font-black ${value >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {hideValues ? '••••' : fmt(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={16} className="text-indigo-500" />
              <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contexto Avançado</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
                Confiança {Math.round(intelligence.context.confidence.overall * 100)}%
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                Recorrências {intelligence.recurringCount}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                Dados {intelligence.merchantCoveragePercent}%
              </span>
              {intelligence.dominantCategoryLabel && (
                <span className="px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 text-[8px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">
                  {intelligence.dominantCategoryLabel}
                </span>
              )}
            </div>
          </div>

          {/* ── Seção 1: Insights Financeiros ───────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-indigo-500" />
              <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Insights Financeiros</h3>
              <span className="ml-auto text-[8px] font-black bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full">{insights.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {insights.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  <p className="text-sm font-bold text-slate-700 dark:text-white">Tudo sob controle! Nenhum padrão crítico detectado.</p>
                </div>
              ) : (
                insights.map(i => <InsightCard key={i.id} insight={i} />)
              )}
            </div>
          </section>

          {/* ── Seção 2: Perfil Financeiro ───────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-violet-500" />
              <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Perfil Financeiro</h3>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl">{profileResult.emoji}</span>
                <div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{profileResult.label}</p>
                  <p className="text-[8px] font-black text-violet-500 uppercase tracking-widest">{profileResult.profile}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-bold leading-relaxed mb-4">
                {profileResult.description}
              </p>

              {/* Score bars */}
              <div className="flex flex-col gap-2 mt-2">
                {(Object.entries(profileResult.score) as [string, number][])
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, score]) => {
                    const allScores = Object.values(profileResult.score) as number[];
                    const maxScore = Math.max(...allScores, 1);
                    const pct = Math.round((score / maxScore) * 100);
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight w-28 shrink-0 truncate">{key.replace('_', ' ')}</p>
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[8px] font-black text-slate-400 w-8 text-right">{pct}%</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>

          {/* ── Seção 3: Alertas de Risco ────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={16} className="text-rose-500" />
              <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Alertas Financeiros</h3>
              {risks.length > 0 && (
                <span className="ml-auto text-[8px] font-black bg-rose-50 dark:bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">{risks.length}</span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {risks.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  <p className="text-sm font-bold text-slate-700 dark:text-white">Nenhum risco detectado no horizonte.</p>
                </div>
              ) : (
                risks.map(r => <RiskCard key={r.id} alert={r} />)
              )}
            </div>
          </section>

          {/* Footer note */}
          <div className="flex items-start gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
            <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
              Análises geradas dinamicamente com base nas suas transações. Nenhum dado é enviado para servidores externos.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default Insights;
