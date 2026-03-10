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
}

export function buildAdvancedAIContext(userContext: UserContext, transactions: Transaction[]): AdvancedAIContext {
  const base = buildAIContext({ userContext, transactions });
  const patterns = financialPatternDetector.detectPatterns(transactions);
  const moneyMap = moneyMapEngine.generate(transactions);
  const cashflowForecast = cashflowPredictionEngine.predict({
    balance: base.balance,
    transactions,
    patterns,
  });

  return {
    base,
    patterns,
    moneyMap,
    cashflowForecast,
    recurringExpenses: getRecurringExpenses(userContext.userId),
    learnedProfile: getFinancialProfile(userContext.userId),
  };
}
