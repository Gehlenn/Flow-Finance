import { Transaction } from '../../../../types';
import { UserContext } from '../../../context/UserContext';
import { buildAIContext } from '../aiContextBuilder';
import { financialPatternDetector } from '../../finance/patternDetector/financialPatternDetector';
import { getFinancialProfile, getRecurringExpenses } from '../../../ai/memory/AIMemoryEngine';
import { moneyMapEngine } from '../../finance/moneyMap/moneyMapEngine';
import { cashflowPredictionEngine } from '../../finance/cashflowPrediction/cashflowPredictionEngine';

export interface AdvancedAIContext {
  base: ReturnType<typeof buildAIContext>;
  patterns: ReturnType<typeof financialPatternDetector.detectPatterns>;
  moneyMap: ReturnType<typeof moneyMapEngine.generate>;
  cashflowForecast: ReturnType<typeof cashflowPredictionEngine.predict>;
  recurringExpenses: ReturnType<typeof getRecurringExpenses>;
  learnedProfile: ReturnType<typeof getFinancialProfile>;
  dominantCategory: ReturnType<typeof moneyMapEngine.getDominantCategory>;
  recentTransactions: Transaction[];
  dataQuality: {
    transactionCount: number;
    merchantCoverage: number;
    datedTransactions: number;
  };
  confidence: {
    patterns: number;
    forecast: number;
    overall: number;
  };
}

export function buildAdvancedAIContext(userContext: UserContext, transactions: Transaction[]): AdvancedAIContext {
  const sortedTransactions = [...transactions].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  const base = buildAIContext({ userContext, transactions: sortedTransactions });
  const patterns = financialPatternDetector.detectPatterns(sortedTransactions);
  const moneyMap = moneyMapEngine.generate(sortedTransactions);
  const dominantCategory = moneyMapEngine.getDominantCategory(sortedTransactions);
  const cashflowForecast = cashflowPredictionEngine.predict({
    balance: base.balance,
    transactions: sortedTransactions,
    patterns,
  });

  const merchantCoverageCount = sortedTransactions.filter((transaction) => {
    const merchant = (transaction.merchant || '').trim();
    return merchant.length > 0;
  }).length;

  const datedTransactions = sortedTransactions.filter((transaction) => !Number.isNaN(new Date(transaction.date).getTime())).length;
  const totalTransactions = Math.max(1, sortedTransactions.length);

  const dataQuality = {
    transactionCount: sortedTransactions.length,
    merchantCoverage: merchantCoverageCount / totalTransactions,
    datedTransactions,
  };

  const patternConfidence = patterns.confidence?.overall || 0;
  const forecastReliability = sortedTransactions.length >= 3 ? Math.min(1, sortedTransactions.length / 12) : 0.25;

  return {
    base,
    patterns,
    moneyMap,
    cashflowForecast,
    dominantCategory,
    recentTransactions: sortedTransactions.slice(0, 10),
    dataQuality,
    confidence: {
      patterns: patternConfidence,
      forecast: forecastReliability,
      overall: ((patternConfidence * 0.6) + (forecastReliability * 0.4)),
    },
    recurringExpenses: getRecurringExpenses(userContext.userId),
    learnedProfile: getFinancialProfile(userContext.userId),
  };
}
