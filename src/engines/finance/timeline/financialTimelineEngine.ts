export interface TimelineTransaction {
  date: string;
  amount: number;
  category?: string;
  merchant?: string;
}

export interface FinancialTimelineMonth {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  events: string[];
}

export function buildFinancialTimeline(transactions: TimelineTransaction[]): FinancialTimelineMonth[] {
  const months: Record<string, TimelineTransaction[]> = {};

  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (Number.isNaN(d.getTime())) continue;

    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[key]) months[key] = [];
    months[key].push(tx);
  }

  return Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, items]) => {
      const income = items
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = items
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        month,
        income: Number(income.toFixed(2)),
        expenses: Number(expenses.toFixed(2)),
        balance: Number((income - expenses).toFixed(2)),
        events: [],
      };
    });
}
