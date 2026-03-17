import { Account } from '../../models/Account';
import { Transaction } from '../../types';
import { AIMemoryType } from '../ai/memory/memoryTypes';
import { createUserContext } from '../context/UserContext';
import { buildAdvancedAIContext, AdvancedAIContext } from '../engines/ai/contextBuilder/advancedContextBuilder';
import { detectBalanceTrend, detectTimelineAnomalies, type BalanceTrend, type TimelineAnomaly } from '../engines/finance/financialTimeline';

export interface ProductSignalFeedbackTarget {
  label: string;
  type: AIMemoryType;
  key: string;
  context: string;
}

export interface ProductFinancialIntelligence {
  context: AdvancedAIContext;
  balanceTrend: BalanceTrend;
  timelineAnomalies: TimelineAnomaly[];
  merchantCoveragePercent: number;
  recurringCount: number;
  dominantCategoryLabel: string | null;
  dominantCategorySharePercent: number;
  weeklySpikeCount: number;
  forecastDirection: 'improving' | 'declining' | 'stable';
  productSignals: string[];
  signalFeedbackTargets: ProductSignalFeedbackTarget[];
}

function resolveForecastDirection(
  forecast: AdvancedAIContext['cashflowForecast']
): 'improving' | 'declining' | 'stable' {
  const delta = forecast.in90Days - forecast.in7Days;
  if (delta > 50) {
    return 'improving';
  }

  if (delta < -50) {
    return 'declining';
  }

  return 'stable';
}

function buildProductSignals(input: {
  recurringCount: number;
  weeklySpikeCount: number;
  dominantCategoryLabel: string | null;
  dominantCategorySharePercent: number;
  merchantCoveragePercent: number;
  forecastDirection: 'improving' | 'declining' | 'stable';
}): string[] {
  const signals: string[] = [];

  if (input.recurringCount > 0) {
    signals.push(`Recorrencias detectadas: ${input.recurringCount}`);
  }

  if (input.weeklySpikeCount > 0) {
    signals.push(`Picos semanais: ${input.weeklySpikeCount}`);
  }

  if (input.dominantCategoryLabel && input.dominantCategorySharePercent >= 40) {
    signals.push(`Concentracao em ${input.dominantCategoryLabel}: ${input.dominantCategorySharePercent}%`);
  }

  if (input.merchantCoveragePercent < 40) {
    signals.push('Qualidade de dados baixa: complete dados de merchant para melhorar a IA');
  }

  if (input.forecastDirection === 'declining') {
    signals.push('Tendencia de caixa em queda para 90 dias');
  }

  if (input.forecastDirection === 'improving') {
    signals.push('Tendencia de caixa em melhora para 90 dias');
  }

  return signals;
}

function buildSignalFeedbackTargets(input: {
  recurringCount: number;
  weeklySpikeCount: number;
  dominantCategoryLabel: string | null;
  dominantCategorySharePercent: number;
}): ProductSignalFeedbackTarget[] {
  const targets: ProductSignalFeedbackTarget[] = [];

  if (input.recurringCount > 0) {
    targets.push({
      label: `Recorrencias detectadas: ${input.recurringCount}`,
      type: AIMemoryType.RECURRING_EXPENSE,
      key: 'recurring_expenses',
      context: 'dashboard_signal',
    });
  }

  if (input.weeklySpikeCount > 0) {
    targets.push({
      label: `Picos semanais: ${input.weeklySpikeCount}`,
      type: AIMemoryType.SPENDING_PATTERN,
      key: 'weekly_spikes',
      context: 'dashboard_signal',
    });
  }

  if (input.dominantCategoryLabel && input.dominantCategorySharePercent >= 40) {
    targets.push({
      label: `Concentracao em ${input.dominantCategoryLabel}: ${input.dominantCategorySharePercent}%`,
      type: AIMemoryType.SPENDING_PATTERN,
      key: 'category_dominance',
      context: 'dashboard_signal',
    });
  }

  return targets;
}

export function buildProductFinancialIntelligence(input: {
  userId?: string | null;
  accounts?: Account[];
  transactions: Transaction[];
}): ProductFinancialIntelligence {
  const userContext = createUserContext({
    userId: input.userId || 'local',
    accounts: (input.accounts || []).map((account) => account.id),
    currency: input.accounts?.[0]?.currency || 'BRL',
  });

  const context = buildAdvancedAIContext(userContext, input.transactions);
  const dominantCategorySharePercent = Math.round(context.dominantCategory?.percentage || 0);
  const recurringCount = context.patterns.recurringInsights.length;
  const weeklySpikeCount = context.patterns.weeklySpikeInsights.length;
  const merchantCoveragePercent = Math.round(context.dataQuality.merchantCoverage * 100);
  const forecastDirection = resolveForecastDirection(context.cashflowForecast);
  const dominantCategoryLabel = context.dominantCategory?.category || null;

  return {
    context,
    balanceTrend: detectBalanceTrend(context.base.timeline),
    timelineAnomalies: detectTimelineAnomalies(context.base.timeline),
    merchantCoveragePercent,
    recurringCount,
    dominantCategoryLabel,
    dominantCategorySharePercent,
    weeklySpikeCount,
    forecastDirection,
    productSignals: buildProductSignals({
      recurringCount,
      weeklySpikeCount,
      dominantCategoryLabel,
      dominantCategorySharePercent,
      merchantCoveragePercent,
      forecastDirection,
    }),
    signalFeedbackTargets: buildSignalFeedbackTargets({
      recurringCount,
      weeklySpikeCount,
      dominantCategoryLabel,
      dominantCategorySharePercent,
    }),
  };
}