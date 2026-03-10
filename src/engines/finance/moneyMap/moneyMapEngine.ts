import { Transaction, TransactionType } from '../../../../types';

export interface MoneyMapSlice {
  category: string;
  amount: number;
  percentage: number;
}

export class MoneyMapEngine {
  private lastDistribution: MoneyMapSlice[] = [];

  generate(transactions: Transaction[]): MoneyMapSlice[] {
    const totals: Record<string, number> = {};

    for (const transaction of transactions) {
      if (transaction.type !== TransactionType.DESPESA) {
        continue;
      }

      const category = String(transaction.category || 'Outros');
      totals[category] = (totals[category] || 0) + Math.abs(transaction.amount);
    }

    const totalExpenses = Object.values(totals).reduce((sum, value) => sum + value, 0);
    this.lastDistribution = Object.entries(totals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }))
      .sort((left, right) => right.amount - left.amount);

    return this.lastDistribution;
  }

  getLastDistribution(): MoneyMapSlice[] {
    return [...this.lastDistribution];
  }

  getDominantCategory(transactions: Transaction[]): MoneyMapSlice | null {
    const distribution = this.generate(transactions);
    return distribution[0] || null;
  }
}

export const moneyMapEngine = new MoneyMapEngine();