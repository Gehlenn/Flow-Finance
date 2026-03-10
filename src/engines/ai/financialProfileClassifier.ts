import { Transaction, TransactionType } from '../../../types';

export type FinancialProfile = 'Saver' | 'Spender' | 'Balanced' | 'Risk Taker';

export interface FinancialProfileResult {
  profile: FinancialProfile;
  savingsRate: number;
  income: number;
  expenses: number;
}

export function classifyFinancialProfile(transactions: Transaction[]): FinancialProfileResult {
  const income = transactions
    .filter((t) => t.type === TransactionType.RECEITA)
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.type === TransactionType.DESPESA)
    .reduce((sum, t) => sum + t.amount, 0);

  if (income <= 0) {
    return {
      profile: 'Risk Taker',
      savingsRate: -1,
      income,
      expenses,
    };
  }

  const savingsRate = (income - expenses) / income;

  if (savingsRate >= 0.3) {
    return { profile: 'Saver', savingsRate, income, expenses };
  }

  if (savingsRate < 0) {
    return { profile: 'Spender', savingsRate, income, expenses };
  }

  if (savingsRate <= 0.05) {
    return { profile: 'Risk Taker', savingsRate, income, expenses };
  }

  return { profile: 'Balanced', savingsRate, income, expenses };
}
