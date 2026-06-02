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

// ─── Sub-components ──────────────────────────────────────────────────────────

const InsightCard: React.FC<{ insight: AIInsight }> = ({ insight }) => {
  const s = SEVERITY_STYLES[insight.severity ?? 'low'];
  return (
    <div className={`${s.bg} border ${s.border} rounded-[1.8rem] p-5 flex gap-4 items-start`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.icon}`}>
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
    <div className={`${s.bg} border ${s.border} rounded-[1.8rem] p-5 flex gap-4 items-start`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.icon}`}>
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
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Sparkles size={14} />
            Acompanhar risco
          </button>
        )}
        {typeof onNavigateToTab === 'function' && (
          <button
            type="button"
            onClick={() => onNavigateToTab('flow')}
            className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
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
    <div className="flex flex-col gap-6 animate-in fade-in duration-700 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight leading-none text-slate-900 dark:text-white">Leituras financeiras</h2>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
            Workspace: {activeWorkspaceName || 'Carregando workspace'}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Leitura operacional do caixa</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Brain size={20} />
        </div>
      </div>

      {isEmpty && (
        <div className="flex flex-col items-center py-16 gap-4 text-slate-300 dark:text-slate-600">
          <Sparkles size={40} />
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-center">
            Adicione transações para ver as leituras do caixa
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
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">Saúde do caixa</p>
              </div>
              <span className={`text-xs font-semibold uppercase tracking-[0.08em] px-3 py-1 rounded-full text-white ${hs.bg}`}>
                {health_label}
              </span>
            </div>
            <div className="flex items-end gap-3 mb-3">
              <p className={`text-5xl font-semibold leading-none ${hs.text}`}>{health_score}</p>
              <p className="text-slate-400 font-semibold text-lg mb-1">/100</p>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${hs.bar} rounded-full transition-all duration-1000`}
                style={{ width: `${health_score}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {pipeline.processing_ms}ms · pipeline v{pipeline.computed_at ? '0.3' : '—'}
            </p>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-100 dark:border-slate-700">
              <Zap size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Próxima ação</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug mt-1">
                  {nextActionSummary}
                </p>
              </div>
            </div>
            {canShowActions && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('assistant')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  <MessageSquare size={14} />
                  Abrir assistente
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('goals')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 transition-colors hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Target size={14} />
                  Ver metas
                </button>
                {typeof onCreateReminder === 'function' && (
                  <button
                    type="button"
                    onClick={handleCreateReminder}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                  >
                    <Sparkles size={14} />
                    Criar lembrete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Projeção Rápida ─────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 grid grid-cols-3 gap-3 border border-slate-100 dark:border-slate-700 shadow-sm">
            {[
              { label: 'Hoje', value: prediction.currentBalance },
              { label: '7 dias', value: prediction.in7Days },
              { label: '30 dias', value: prediction.in30Days },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1 items-center text-center">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">{label}</p>
                <p className={`text-sm font-semibold ${value >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {hideValues ? '••••' : fmt(value)}
                </p>
              </div>
            ))}
          </div>

          {canUseAdvancedInsights && (
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={16} className="text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Contexto avançado</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">
                  Confianca {Math.round(intelligence.context.confidence.overall * 100)}%
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                  Recorrencias {intelligence.recurringCount}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                  Dados {intelligence.merchantCoveragePercent}%
                </span>
                {intelligence.dominantCategoryLabel && (
                  <span className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">
                    {intelligence.dominantCategoryLabel}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Seção 1: Insights Financeiros ───────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-slate-500" />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Sinais do caixa</h3>
              <span className="ml-auto text-xs font-semibold bg-slate-50 dark:bg-slate-900/50 text-slate-500 px-2 py-0.5 rounded-full">{visibleInsights.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {visibleInsights.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  <p className="text-sm font-medium text-slate-700 dark:text-white">Tudo sob controle! Nenhum padrão crítico detectado.</p>
                </div>
              ) : (
                visibleInsights.map(i => <InsightCard key={i.id} insight={i} />)
              )}
            </div>
          </section>

          {/* ── Seção 2: Perfil Financeiro ───────────────────────────────── */}
          {canUseHistoricalComparisons && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-slate-500" />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Perfil de fluxo</h3>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl">{profileResult.emoji}</span>
                  <div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{profileResult.label}</p>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.08em]">{profileResult.profile}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-4">
                  {profileResult.description}
                </p>

                <div className="flex flex-col gap-2 mt-2">
                  {(Object.entries(profileResult.score) as [string, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([key, score]) => {
                      const allScores = Object.values(profileResult.score) as number[];
                      const maxScore = Math.max(...allScores, 1);
                      const pct = Math.round((score / maxScore) * 100);
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-tight w-28 shrink-0 truncate">{key.replace('_', ' ')}</p>
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-500 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs font-semibold text-slate-400 w-8 text-right">{pct}%</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>
          )}

          {/* ── Seção 3: Alertas de Risco ────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={16} className="text-rose-500" />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Riscos do caixa</h3>
              {visibleRisks.length > 0 && (
                <span className="ml-auto text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">{visibleRisks.length}</span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {visibleRisks.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  <p className="text-sm font-medium text-slate-700 dark:text-white">Nenhum risco detectado no horizonte.</p>
                </div>
              ) : (
                visibleRisks.map(r => (
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

          {/* Footer note */}
          <div className="flex items-start gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
            <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Análises geradas dinamicamente com base nas suas transações. Nenhum dado é enviado para servidores externos.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default Insights;





