import { buildMonthlyForecast } from '../finance/forecastEngine';
import { calculateCashflowSummary } from '../finance/cashflowEngine';
import { buildFinancialTimeline, FinancialTimeline } from '../finance/financialTimeline';
import { classifyFinancialProfile, FinancialProfileResult } from './financialProfileClassifier';
import { Transaction, TransactionType } from '../../../types';
import { UserContext } from '../../context/UserContext';

export interface AIContextInput {
  userContext: UserContext;
  transactions: Transaction[];
  memory?: Record<string, unknown>;
}

export interface AIContext {
  userId: string;
  accounts: string[];
  timezone: string;
  balance: number;
  monthlySpending: number;
  monthlyIncome: number;
  trend: ReturnType<typeof buildMonthlyForecast>;
  timeline: FinancialTimeline;
  financialProfile: FinancialProfileResult;
  memory?: Record<string, unknown>;
}

export function buildAIContext(input: AIContextInput): AIContext {
  const summary = calculateCashflowSummary(input.transactions);
  const trend = buildMonthlyForecast(input.transactions as Array<{ amount: number; type: TransactionType; date: string }>, 6);
  const timeline = buildFinancialTimeline(input.transactions);
  const financialProfile = classifyFinancialProfile(input.transactions);

  return {
    userId: input.userContext.userId,
    accounts: input.userContext.accounts,
    timezone: input.userContext.timezone,
    balance: summary.balance,
    monthlySpending: summary.expenses,
    monthlyIncome: summary.income,
    trend,
    timeline,
    financialProfile,
    memory: input.memory,
  };
}
