import { Transaction, TransactionType } from '../../../../types';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatRecurringDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseRecurringDate(dateValue: string): Date | null {
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

export interface DetectedRecurringTransaction {
  merchant: string;
  amount: number;
  occurrences: number;
  cadenceDays: number;
  nextExpectedDate?: string;
  sample: Transaction;
}

function averageCadenceDays(transactions: Transaction[]): number {
  if (transactions.length < 2) {
    return 30;
  }

  const sorted = [...transactions].sort(
    (left, right) => (parseRecurringDate(left.date)?.getTime() ?? 0) - (parseRecurringDate(right.date)?.getTime() ?? 0)
  );

  let totalDiff = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const current = parseRecurringDate(sorted[index].date)?.getTime();
    const previous = parseRecurringDate(sorted[index - 1].date)?.getTime();
    if (current == null || previous == null) {
      continue;
    }
    totalDiff += Math.max(1, Math.round((current - previous) / (1000 * 60 * 60 * 24)));
  }

  return Math.max(1, Math.round(totalDiff / (sorted.length - 1)));
}

export const recurringDetector = {
  detect(transactions: Transaction[]): DetectedRecurringTransaction[] {
    const grouped: Record<string, Transaction[]> = {};

    for (const transaction of transactions) {
      if (transaction.type !== TransactionType.DESPESA) {
        continue;
      }

      const merchant = (transaction.merchant || transaction.description || 'unknown').trim();
      const key = `${merchant.toLowerCase()}-${Math.abs(transaction.amount)}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(transaction);
    }

    return Object.values(grouped)
      .filter((group) => group.length >= 3)
      .map((group) => {
        const cadenceDays = averageCadenceDays(group);
        const sorted = [...group].sort(
          (left, right) => (parseRecurringDate(left.date)?.getTime() ?? 0) - (parseRecurringDate(right.date)?.getTime() ?? 0)
        );
        const lastTransaction = sorted[sorted.length - 1];
        const nextExpectedDate = parseRecurringDate(lastTransaction.date);
        if (!nextExpectedDate) {
          const fallbackDate = new Date();
          fallbackDate.setDate(fallbackDate.getDate() + cadenceDays);
          return {
            merchant: lastTransaction.merchant || lastTransaction.description || 'unknown',
            amount: Math.abs(lastTransaction.amount),
            occurrences: group.length,
            cadenceDays,
            nextExpectedDate: formatRecurringDateKey(fallbackDate),
            sample: lastTransaction,
          };
        }
        nextExpectedDate.setDate(nextExpectedDate.getDate() + cadenceDays);

        return {
          merchant: lastTransaction.merchant || lastTransaction.description || 'unknown',
          amount: Math.abs(lastTransaction.amount),
          occurrences: group.length,
          cadenceDays,
          nextExpectedDate: formatRecurringDateKey(nextExpectedDate),
          sample: lastTransaction,
        };
      });
  },
};
