import { buildMonthlyForecast } from '../finance/forecastEngine';
import { calculateCashflowSummary } from '../finance/cashflowEngine';
import { Transaction, TransactionType } from '../../../types';

export interface AIContextInput {
  user: { id: string; name?: string };
  transactions: Transaction[];
  memory?: Record<string, unknown>;
}

export interface AIContext {
  userId: string;
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
    userId: input.user.id,
    balance: summary.balance,
    monthlySpending: summary.expenses,
    monthlyIncome: summary.income,
    trend,
    memory: input.memory,
  };
}
