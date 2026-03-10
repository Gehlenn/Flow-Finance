import { buildMonthlyForecast } from '../finance/forecastEngine';
import { calculateCashflowSummary } from '../finance/cashflowEngine';
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
  memory?: Record<string, unknown>;
}

export function buildAIContext(input: AIContextInput): AIContext {
  const summary = calculateCashflowSummary(input.transactions);
  const trend = buildMonthlyForecast(input.transactions as Array<{ amount: number; type: TransactionType; date: string }>, 6);

  return {
    userId: input.userContext.userId,
    accounts: input.userContext.accounts,
    timezone: input.userContext.timezone,
    balance: summary.balance,
    monthlySpending: summary.expenses,
    monthlyIncome: summary.income,
    trend,
    memory: input.memory,
  };
}
