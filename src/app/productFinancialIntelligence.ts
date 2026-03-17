import { Account } from '../../models/Account';
import { Transaction } from '../../types';
import { createUserContext } from '../context/UserContext';
import { buildAdvancedAIContext, AdvancedAIContext } from '../engines/ai/contextBuilder/advancedContextBuilder';
import { detectBalanceTrend, detectTimelineAnomalies, type BalanceTrend, type TimelineAnomaly } from '../engines/finance/financialTimeline';

export interface ProductFinancialIntelligence {
  context: AdvancedAIContext;
  balanceTrend: BalanceTrend;
  timelineAnomalies: TimelineAnomaly[];
  merchantCoveragePercent: number;
  recurringCount: number;
  dominantCategoryLabel: string | null;
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

  return {
    context,
    balanceTrend: detectBalanceTrend(context.base.timeline),
    timelineAnomalies: detectTimelineAnomalies(context.base.timeline),
    merchantCoveragePercent: Math.round(context.dataQuality.merchantCoverage * 100),
    recurringCount: context.patterns.recurringInsights.length,
    dominantCategoryLabel: context.dominantCategory?.category || null,
  };
}