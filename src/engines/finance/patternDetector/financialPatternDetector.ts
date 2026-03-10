import { Transaction, TransactionType } from '../../../../types';

export interface FinancialPatterns {
  recurring: Transaction[][];
  weeklySpikes: Transaction[];
  categoryDominance: [string, number] | null;
}

export class FinancialPatternDetector {
  private lastPatterns: FinancialPatterns = {
    recurring: [],
    weeklySpikes: [],
    categoryDominance: null,
  };

  detectPatterns(transactions: Transaction[]): FinancialPatterns {
    this.lastPatterns = {
      recurring: this.detectRecurring(transactions),
      weeklySpikes: this.detectWeeklySpikes(transactions),
      categoryDominance: this.detectCategoryDominance(transactions),
    };

    return this.lastPatterns;
  }

  getPatterns(): FinancialPatterns {
    return this.lastPatterns;
  }

  detectRecurring(transactions: Transaction[]): Transaction[][] {
    const map: Record<string, Transaction[]> = {};

    for (const t of transactions) {
      if (t.type !== TransactionType.DESPESA) {
        continue;
      }

      const merchant = (t.merchant || t.description || 'unknown').toLowerCase().trim();
      const key = `${merchant}-${t.amount}`;

      if (!map[key]) {
        map[key] = [];
      }

      map[key].push(t);
    }

    return Object.values(map).filter((list) => list.length >= 3);
  }

  detectWeeklySpikes(transactions: Transaction[]): Transaction[] {
    return transactions.filter((t) => {
      if (t.type !== TransactionType.DESPESA) {
        return false;
      }

      const day = new Date(t.date).getDay();
      return day === 0 || day === 6;
    });
  }

  detectCategoryDominance(transactions: Transaction[]): [string, number] | null {
    const totals: Record<string, number> = {};

    for (const t of transactions) {
      if (t.type !== TransactionType.DESPESA) {
        continue;
      }

      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return entries[0] || null;
  }
}

export const financialPatternDetector = new FinancialPatternDetector();
