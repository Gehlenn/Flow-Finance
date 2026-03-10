import { Transaction, TransactionType } from '../../../types';

export interface TimelinePoint {
  date: string;
  income: number;
  expenses: number;
  balance: number;
}

export interface FinancialTimeline {
  points: TimelinePoint[];
  totals: {
    income: number;
    expenses: number;
    finalBalance: number;
  };
}

export function buildFinancialTimeline(transactions: Transaction[]): FinancialTimeline {
  const grouped = new Map<string, { income: number; expenses: number }>();

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const tx of sorted) {
    const dayKey = new Date(tx.date).toISOString().slice(0, 10);
    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, { income: 0, expenses: 0 });
    }

    const day = grouped.get(dayKey)!;
    if (tx.type === TransactionType.RECEITA) {
      day.income += tx.amount;
    } else {
      day.expenses += tx.amount;
    }
  }

  let runningBalance = 0;
  const points: TimelinePoint[] = Array.from(grouped.entries()).map(([date, values]) => {
    runningBalance += values.income - values.expenses;
    return {
      date,
      income: values.income,
      expenses: values.expenses,
      balance: runningBalance,
    };
  });

  const totals = points.reduce(
    (acc, p) => {
      acc.income += p.income;
      acc.expenses += p.expenses;
      acc.finalBalance = p.balance;
      return acc;
    },
    { income: 0, expenses: 0, finalBalance: 0 }
  );

  return { points, totals };
}
