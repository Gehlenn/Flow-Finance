interface Transaction {
  id?: string;
  description: string;
  amount: number;
  category?: string;
  merchant?: string;
}

export class TransactionService {
  public static generateInsights(
    transactions: Transaction[],
    userId: string,
  ): Array<{ userId: string; summary: string }> {
    const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    return [
      {
        userId,
        summary: `Processed ${transactions.length} transactions totaling ${total.toFixed(2)}`,
      },
    ];
  }

  public static detectSubscriptions(
    transactions: Transaction[],
  ): Array<{ merchant: string; occurrences: number }> {
    const counts = new Map<string, number>();

    for (const transaction of transactions) {
      const merchant = transaction.merchant || transaction.description;
      counts.set(merchant, (counts.get(merchant) || 0) + 1);
    }

    return Array.from(counts.entries())
      .filter(([, occurrences]) => occurrences >= 2)
      .map(([merchant, occurrences]) => ({ merchant, occurrences }));
  }
}
