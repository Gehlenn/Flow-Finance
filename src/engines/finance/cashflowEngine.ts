import { TransactionType } from '../../../types';
import { UserContext } from '../../context/UserContext';

export interface CashflowTransaction {
  amount: number;
  type?: TransactionType;
}

export interface CashflowSummary {
  income: number;
  expenses: number;
  balance: number;
}

export function calculateCashflow(transactions: CashflowTransaction[], _userContext?: UserContext): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

export function calculateCashflowSummary(transactions: CashflowTransaction[], _userContext?: UserContext): CashflowSummary {
  const summary = transactions.reduce(
    (acc, tx) => {
      const isIncome = tx.type === TransactionType.RECEITA;
      if (isIncome) {
        acc.income += tx.amount;
      } else {
        acc.expenses += tx.amount;
      }
      return acc;
    },
    { income: 0, expenses: 0, balance: 0 }
  );

  summary.balance = summary.income - summary.expenses;
  return summary;
}
