import { Transaction } from '../../../../types';
import { UserContext } from '../../../context/UserContext';
import { buildAIContext } from '../aiContextBuilder';
import { financialPatternDetector } from '../../finance/patternDetector/financialPatternDetector';
import { getFinancialProfile, getRecurringExpenses } from '../../../ai/memory/AIMemoryEngine';

export interface AdvancedAIContext {
  base: ReturnType<typeof buildAIContext>;
  patterns: ReturnType<typeof financialPatternDetector.detectPatterns>;
  recurringExpenses: ReturnType<typeof getRecurringExpenses>;
  learnedProfile: ReturnType<typeof getFinancialProfile>;
}

export function buildAdvancedAIContext(userContext: UserContext, transactions: Transaction[]): AdvancedAIContext {
  const base = buildAIContext({ userContext, transactions });
  const patterns = financialPatternDetector.detectPatterns(transactions);

  return {
    base,
    patterns,
    recurringExpenses: getRecurringExpenses(userContext.userId),
    learnedProfile: getFinancialProfile(userContext.userId),
  };
}
