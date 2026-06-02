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

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseTimelineDate(dateValue: string): Date | null {
  const trimmed = dateValue.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() !== year
      || localDate.getMonth() !== month
      || localDate.getDate() !== day
    ) {
      return null;
    }
    return localDate;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildFinancialTimeline(transactions: TimelineTransaction[]): FinancialTimelineMonth[] {
  const months: Record<string, TimelineTransaction[]> = {};

  for (const tx of transactions) {
    const d = parseTimelineDate(tx.date);
    if (!d) continue;

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
