import { Transaction, TransactionType } from '../../../../types';

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
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
  );

  let totalDiff = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const current = new Date(sorted[index].date).getTime();
    const previous = new Date(sorted[index - 1].date).getTime();
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
          (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
        );
        const lastTransaction = sorted[sorted.length - 1];
        const nextExpectedDate = new Date(lastTransaction.date);
        nextExpectedDate.setDate(nextExpectedDate.getDate() + cadenceDays);

        return {
          merchant: lastTransaction.merchant || lastTransaction.description || 'unknown',
          amount: Math.abs(lastTransaction.amount),
          occurrences: group.length,
          cadenceDays,
          nextExpectedDate: nextExpectedDate.toISOString(),
          sample: lastTransaction,
        };
      });
  },
};