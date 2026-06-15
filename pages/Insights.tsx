import React, { useCallback, useMemo } from 'react';
import { ReminderType, type Reminder, Transaction } from '../types';
import { runAIPipelineSync } from '../src/ai/aiOrchestrator';
import { AIInsight } from '../src/ai/insightGenerator';
import { FinancialRiskAlert } from '../src/ai/riskAnalyzer';
import { buildProductFinancialIntelligence } from '../src/app/productFinancialIntelligence';
import {
  Sparkles, TrendingUp, TrendingDown, ShieldAlert,
  Lightbulb, PiggyBank, AlertTriangle, CheckCircle2,
  BarChart3, Brain, Zap, Info, Activity, MessageSquare, Target
} from 'lucide-react';
import { canAccessFeature } from '../src/app/monetizationPlan';
import UpgradePromptCard from '../components/UpgradePromptCard';
import type { Tab } from '../hooks/navigationTypes';

interface InsightsProps {
  activeWorkspaceName?: string | null;
  transactions: Transaction[];
  userId?: string;
  workspacePlan?: 'free' | 'pro';
  hideValues: boolean;
  onNavigateToTab?: (tab: Tab) => void;
  onCreateReminder?: (reminder: Partial<Reminder>) => void;
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

const PAGE_SURFACE = 'rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-800';
const SOFT_SURFACE = 'rounded-xl border border-slate-100 bg-slate-50 shadow-none dark:border-slate-700 dark:bg-slate-900/50';
const ICON_SURFACE = 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';

// ─── Sub-components ──────────────────────────────────────────────────────────

const InsightCard: React.FC<{ insight: AIInsight }> = ({ insight }) => {
  const s = SEVERITY_STYLES[insight.severity ?? 'low'];
  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-4 flex gap-3 items-start shadow-none`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg} ${s.icon}`}>
        {INSIGHT_ICON[insight.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-white leading-snug">{insight.message}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full ${s.badge}`}>
            {SEVERITY_LABEL[insight.severity ?? 'low']}
          </span>
          <span className="text-xs text-slate-400 font-medium capitalize">{insight.type}</span>
        </div>
      </div>
    </div>
  );
};

const RiskCard: React.FC<{
  alert: FinancialRiskAlert;
  onCreateReminder?: (alert: FinancialRiskAlert) => void;
  onNavigateToTab?: (tab: Tab) => void;
}> = ({ alert, onCreateReminder, onNavigateToTab }) => {
  const s = SEVERITY_STYLES[alert.severity];
  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-4 flex gap-3 items-start shadow-none`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg} ${s.icon}`}>
        {RISK_ICON[alert.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-white leading-snug">{alert.message}</p>
        <span className={`inline-block mt-2 text-xs font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full ${s.badge}`}>
          Risco {SEVERITY_LABEL[alert.severity]}
        </span>
        {typeof onCreateReminder === 'function' && (
          <button
            type="button"
            onClick={() => onCreateReminder(alert)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Sparkles size={14} />
            Acompanhar risco
          </button>
        )}
        {typeof onNavigateToTab === 'function' && (
          <button
            type="button"
            onClick={() => onNavigateToTab('flow')}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <BarChart3 size={14} />
            Ver fluxo
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const HEALTH_STYLES: Record<string, { bg: string; text: string; bar: string }> = {
  critico: { bg: 'bg-rose-500', text: 'text-rose-500', bar: 'bg-rose-500' },
  atencao: { bg: 'bg-amber-500', text: 'text-amber-500', bar: 'bg-amber-500' },
  estavel: { bg: 'bg-slate-500', text: 'text-slate-500', bar: 'bg-slate-400' },
  saudavel: { bg: 'bg-indigo-500', text: 'text-indigo-500', bar: 'bg-indigo-500' },
  excelente: { bg: 'bg-emerald-500', text: 'text-emerald-500', bar: 'bg-emerald-500' },
};

function normalizeHealthLabel(label: string): string {
  return label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function resolveHealthStyles(label: string): { bg: string; text: string; bar: string } {
  const normalized = normalizeHealthLabel(label);
  return HEALTH_STYLES[normalized] ?? HEALTH_STYLES.saudavel;
}

function buildNextActionReminder(input: {
  prediction: {
    in7Days: number;
    in30Days: number;
  };
  healthScore: number;
}): Partial<Reminder> {
  const urgentProjection = input.prediction.in7Days < 0 || input.prediction.in30Days < 0;
  const severeProjection = Math.min(input.prediction.in7Days, input.prediction.in30Days) < 0;

  return {
    title: severeProjection
      ? 'Cobrir a proxima lacuna de caixa'
      : urgentProjection
        ? 'Revisar o caixa antes do fechamento'
        : 'Revisar a proxima acao do caixa',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    type: ReminderType.NEGOCIO,
    priority: urgentProjection || input.healthScore < 60 ? 'alta' : 'media',
    completed: false,
    amount: severeProjection ? Math.abs(Math.min(input.prediction.in7Days, input.prediction.in30Days)) : undefined,
  };
}

function buildRiskFollowUpReminder(alert: FinancialRiskAlert): Partial<Reminder> {
  const priority = alert.severity === 'high' ? 'alta' : 'media';
  const daysAhead = alert.severity === 'high' ? 1 : 2;

  return {
    title: 'Acompanhar risco do caixa',
    date: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString(),
    type: ReminderType.NEGOCIO,
    priority,
    completed: false,
  };
}


const Insights: React.FC<InsightsProps> = ({
  activeWorkspaceName,
  transactions,
  userId = 'local',
  workspacePlan = 'free',
  hideValues,
  onNavigateToTab,
  onCreateReminder,
}) => {
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
  const canUseAdvancedInsights = canAccessFeature(workspacePlan, 'advancedCashflowAnalysis');
  const canUseHistoricalComparisons = canAccessFeature(workspacePlan, 'historicalComparisons');
  const visibleInsights = canUseAdvancedInsights ? insights : insights.slice(0, 2);
  const visibleRisks = canUseAdvancedInsights ? risks : risks.slice(0, 1);
  const nextActionSummary = useMemo(() => {
    if (prediction.in7Days < 0) {
      return 'Cobrir a lacuna da próxima semana antes de assumir novos compromissos.';
    }

    if (prediction.in30Days < 0) {
      return 'Atenção: cortar saídas agora para evitar saldo negativo no mês.';
    }

    if (health_score < 60) {
      return 'Reduzir despesas variáveis e revisar recorrências.';
    }

    return 'Manter ritmo e confirmar as próximas entradas.';
  }, [health_score, prediction.in30Days, prediction.in7Days]);

  const handleCreateReminder = useCallback(() => {
    if (!onCreateReminder) {
      return;
    }

    onCreateReminder(buildNextActionReminder({
      prediction: {
        in7Days: prediction.in7Days,
        in30Days: prediction.in30Days,
      },
      healthScore: health_score,
    }));
  }, [health_score, onCreateReminder, prediction.in30Days, prediction.in7Days]);

  const handleRiskFollowUp = useCallback((alert: FinancialRiskAlert) => {
    if (!onCreateReminder) {
      return;
    }

    onCreateReminder(buildRiskFollowUpReminder(alert));
  }, [onCreateReminder]);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const isEmpty = transactions.filter(t => !t.generated).length === 0;
  const hs = resolveHealthStyles(health_label);
  const canShowActions = typeof onNavigateToTab === 'function' || typeof onCreateReminder === 'function';

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-24">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-none dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight leading-tight text-slate-900 dark:text-white sm:text-2xl">Leituras financeiras</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
            Workspace: {activeWorkspaceName || 'Carregando workspace'}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Leitura operacional do caixa</p>
        </div>
        <div className={ICON_SURFACE}>
          <Brain size={20} />
        </div>
      </header>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-4 py-16 text-slate-300 dark:text-slate-600">
          <Sparkles size={40} />
          <p className="text-center text-xs font-semibold uppercase tracking-[0.08em]">
            Adicione transações para ver as leituras do caixa
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            <section className={`${PAGE_SURFACE} p-4 sm:p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={ICON_SURFACE}>
                    <Activity size={15} className={hs.text} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Saúde do caixa</h3>
                    <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">Visão curta do estado atual.</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-white ${hs.bg}`}>
                  {health_label}
                </span>
              </div>

              <div className="mt-4 flex items-end gap-3">
                <p className={`text-4xl font-semibold leading-none sm:text-5xl ${hs.text}`}>{health_score}</p>
                <p className="mb-1 text-base font-semibold text-slate-400 sm:text-lg">/100</p>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className={`h-full ${hs.bar} rounded-full transition-all duration-1000`}
                  style={{ width: `${health_score}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-slate-400">
                {pipeline.processing_ms}ms · pipeline v{pipeline.computed_at ? '0.3' : '—'}
              </p>

              <div className={`${SOFT_SURFACE} mt-4 flex items-start gap-3 p-3`}>
                <Zap size={16} className="mt-0.5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Próxima ação</p>
                  <p className="mt-1 text-sm font-medium leading-snug text-slate-700 dark:text-slate-200">
                    {nextActionSummary}
                  </p>
                </div>
              </div>

              {canShowActions && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateToTab?.('assistant')}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    <MessageSquare size={14} />
                    Abrir assistente
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToTab?.('goals')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Target size={14} />
                    Ver metas
                  </button>
                  {typeof onCreateReminder === 'function' && (
                    <button
                      type="button"
                      onClick={handleCreateReminder}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                    >
                      <Sparkles size={14} />
                      Criar lembrete
                    </button>
                  )}
                </div>
              )}
            </section>

            <div className="space-y-3">
              <section className={`${PAGE_SURFACE} p-4 sm:p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={ICON_SURFACE}>
                      <BarChart3 size={15} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Projeção rápida</h3>
                      <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">Saldo confirmado no curto prazo.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { label: 'Hoje', value: prediction.currentBalance },
                    { label: '7 dias', value: prediction.in7Days },
                    { label: '30 dias', value: prediction.in30Days },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center dark:border-slate-700 dark:bg-slate-900/40">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
                      <p className={`mt-2 text-[13px] font-semibold tabular-nums whitespace-nowrap sm:text-sm ${value >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                        {hideValues ? '••••' : fmt(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {canUseAdvancedInsights && (
                <section className={`${PAGE_SURFACE} p-4 sm:p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={ICON_SURFACE}>
                        <Brain size={15} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Contexto avançado</h3>
                        <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">Sinais adicionais para leitura comparativa do caixa.</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {Math.round(intelligence.context.confidence.overall * 100)}%
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                      Confianca {Math.round(intelligence.context.confidence.overall * 100)}%
                    </span>
                    <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      Recorrencias {intelligence.recurringCount}
                    </span>
                    <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      Dados {intelligence.merchantCoveragePercent}%
                    </span>
                    {intelligence.dominantCategoryLabel && (
                      <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                        {intelligence.dominantCategoryLabel}
                      </span>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          <section className={`${PAGE_SURFACE} p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={ICON_SURFACE}>
                  <Lightbulb size={15} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Sinais do caixa</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">Leituras curtas para agir no caixa agora.</p>
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {visibleInsights.length}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {visibleInsights.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                  <p className="text-sm font-medium text-slate-700 dark:text-white">Tudo sob controle! Nenhum padrão crítico detectado.</p>
                </div>
              ) : (
                visibleInsights.map((i) => <InsightCard key={i.id} insight={i} />)
              )}
            </div>
          </section>

          {canUseHistoricalComparisons && (
            <section className={`${PAGE_SURFACE} p-4 sm:p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={ICON_SURFACE}>
                    <BarChart3 size={15} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Perfil de fluxo</h3>
                    <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">Comparação do comportamento financeiro.</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-3">
                <span className="text-3xl sm:text-4xl">{profileResult.emoji}</span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900 dark:text-white">{profileResult.label}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{profileResult.profile}</p>
                </div>
              </div>

              <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                {profileResult.description}
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {(Object.entries(profileResult.score) as [string, number][])
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, score]) => {
                    const allScores = Object.values(profileResult.score) as number[];
                    const maxScore = Math.max(...allScores, 1);
                    const pct = Math.round((score / maxScore) * 100);
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <p className="w-28 shrink-0 truncate text-xs font-semibold uppercase tracking-tight text-slate-400">{key.replace('_', ' ')}</p>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-slate-500 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="w-8 text-right text-xs font-semibold text-slate-400">{pct}%</p>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          <section className={`${PAGE_SURFACE} p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={ICON_SURFACE}>
                  <ShieldAlert size={15} className="text-rose-500" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Riscos do caixa</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">Alertas de curto prazo que exigem atenção.</p>
                </div>
              </div>
              {visibleRisks.length > 0 && (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-rose-500 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {visibleRisks.length}
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {visibleRisks.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                  <p className="text-sm font-medium text-slate-700 dark:text-white">Nenhum risco detectado no horizonte.</p>
                </div>
              ) : (
                visibleRisks.map((r) => (
                  <RiskCard
                    key={r.id}
                    alert={r}
                    onCreateReminder={handleRiskFollowUp}
                    onNavigateToTab={onNavigateToTab}
                  />
                ))
              )}
            </div>
          </section>

          {!canUseAdvancedInsights && (
            <UpgradePromptCard
              compact
              title="Leituras avançadas e comparativas"
              description="O Free já entrega sinais essenciais. O Pro adiciona contexto avançado para leitura comparativa do caixa."
              bullets={[
                'perfil financeiro detalhado',
                'comparativos historicos mais completos',
                'mais contexto nas analises e alertas de risco',
              ]}
            />
          )}

          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs font-medium leading-relaxed text-slate-400">
              Análises geradas dinamicamente com base nas suas transações. Nenhum dado é enviado para servidores externos.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default Insights;
