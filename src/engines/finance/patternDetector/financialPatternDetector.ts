import { Transaction, TransactionType } from '../../../../types';

export interface RecurringPatternInsight {
  key: string;
  transactions: Transaction[];
  confidence: number;
  averageIntervalDays: number;
  occurrences: number;
}

export interface WeeklySpikeInsight {
  transaction: Transaction;
  confidence: number;
  ratioToMedian: number;
}

export interface PatternConfidenceSummary {
  recurring: number;
  weeklySpikes: number;
  categoryDominance: number;
  overall: number;
}

export interface FinancialPatterns {
  recurring: Transaction[][];
  weeklySpikes: Transaction[];
  categoryDominance: [string, number] | null;
  recurringInsights: RecurringPatternInsight[];
  weeklySpikeInsights: WeeklySpikeInsight[];
  dominantCategoryShare: number;
  confidence: PatternConfidenceSummary;
}

export class FinancialPatternDetector {
  private lastPatterns: FinancialPatterns = {
    recurring: [],
    weeklySpikes: [],
    categoryDominance: null,
    recurringInsights: [],
    weeklySpikeInsights: [],
    dominantCategoryShare: 0,
    confidence: {
      recurring: 0,
      weeklySpikes: 0,
      categoryDominance: 0,
      overall: 0,
    },
  };

  private readonly minRecurringOccurrences = 3;
  private readonly minRecurringConfidence = 0.6;
  private readonly minWeeklySpikeConfidence = 0.55;

  detectPatterns(transactions: Transaction[]): FinancialPatterns {
    const recurringInsights = this.detectRecurringInsights(transactions);
    const weeklySpikeInsights = this.detectWeeklySpikeInsights(transactions);
    const { dominance, share } = this.detectCategoryDominanceWithShare(transactions);

    const recurringConfidence = recurringInsights.length > 0
      ? recurringInsights.reduce((sum, item) => sum + item.confidence, 0) / recurringInsights.length
      : 0;

    const weeklySpikeConfidence = weeklySpikeInsights.length > 0
      ? weeklySpikeInsights.reduce((sum, item) => sum + item.confidence, 0) / weeklySpikeInsights.length
      : 0;

    const categoryDominanceConfidence = dominance ? Math.min(1, share / 0.6) : 0;

    this.lastPatterns = {
      recurring: recurringInsights.map((item) => item.transactions),
      weeklySpikes: weeklySpikeInsights.map((item) => item.transaction),
      categoryDominance: dominance,
      recurringInsights,
      weeklySpikeInsights,
      dominantCategoryShare: share,
      confidence: {
        recurring: recurringConfidence,
        weeklySpikes: weeklySpikeConfidence,
        categoryDominance: categoryDominanceConfidence,
        overall: (recurringConfidence + weeklySpikeConfidence + categoryDominanceConfidence) / 3,
      },
    };

    return this.lastPatterns;
  }

  getPatterns(): FinancialPatterns {
    return this.lastPatterns;
  }

  detectRecurring(transactions: Transaction[]): Transaction[][] {
    return this.detectRecurringInsights(transactions).map((item) => item.transactions);
  }

  detectRecurringInsights(transactions: Transaction[]): RecurringPatternInsight[] {
    const map: Record<string, Transaction[]> = {};

    for (const t of transactions) {
      if (t.type !== TransactionType.DESPESA) {
        continue;
      }

      const merchant = (t.merchant || t.description || 'unknown').toLowerCase().trim();
      const amountBucket = Math.round(Math.abs(t.amount));
      const key = `${merchant}-${amountBucket}`;

      if (!map[key]) {
        map[key] = [];
      }

      map[key].push(t);
    }

    const insights: RecurringPatternInsight[] = [];

    for (const [key, list] of Object.entries(map)) {
      if (list.length < this.minRecurringOccurrences) {
        continue;
      }

      const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const intervals = sorted.slice(1).map((item, index) => {
        const current = new Date(item.date).getTime();
        const previous = new Date(sorted[index].date).getTime();
        return Math.max(1, Math.round((current - previous) / (1000 * 60 * 60 * 24)));
      });

      const avgInterval = intervals.length > 0
        ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
        : 30;
      const avgDeviation = intervals.length > 0
        ? intervals.reduce((sum, value) => sum + Math.abs(value - avgInterval), 0) / intervals.length
        : 0;

      const consistencyScore = Math.max(0, 1 - (avgDeviation / Math.max(1, avgInterval)));
      const occurrencesScore = Math.min(1, (sorted.length - this.minRecurringOccurrences + 1) / 4);
      const confidence = (consistencyScore * 0.7) + (occurrencesScore * 0.3);

      if (confidence < this.minRecurringConfidence) {
        continue;
      }

      insights.push({
        key,
        transactions: sorted,
        confidence,
        averageIntervalDays: avgInterval,
        occurrences: sorted.length,
      });
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  detectWeeklySpikes(transactions: Transaction[]): Transaction[] {
    return this.detectWeeklySpikeInsights(transactions).map((item) => item.transaction);
  }

  detectWeeklySpikeInsights(transactions: Transaction[]): WeeklySpikeInsight[] {
    const expenses = transactions.filter((t) => t.type === TransactionType.DESPESA);
    if (expenses.length === 0) {
      return [];
    }

    const amounts = expenses.map((t) => Math.abs(t.amount)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)] || 0;

    return expenses
      .map((t) => {
      if (t.type !== TransactionType.DESPESA) {
          return null;
      }

      const day = new Date(t.date).getDay();
      const isWeekend = day === 0 || day === 6;
      if (!isWeekend || median <= 0) {
          return null;
      }

      const ratioToMedian = Math.abs(t.amount) / median;
      const intensityScore = Math.max(0, Math.min(1, (ratioToMedian - 1) / 1.5));
      const confidence = 0.45 + (intensityScore * 0.55);

      if (confidence < this.minWeeklySpikeConfidence || Math.abs(t.amount) < 75) {
          return null;
      }

      return {
        transaction: t,
        confidence,
        ratioToMedian,
      } satisfies WeeklySpikeInsight;
      })
      .filter((item): item is WeeklySpikeInsight => item !== null)
      .sort((a, b) => b.confidence - a.confidence);
  }

  detectCategoryDominance(transactions: Transaction[]): [string, number] | null {
    return this.detectCategoryDominanceWithShare(transactions).dominance;
  }

  private detectCategoryDominanceWithShare(transactions: Transaction[]): { dominance: [string, number] | null; share: number } {
    const totals: Record<string, number> = {};

    for (const t of transactions) {
      if (t.type !== TransactionType.DESPESA) {
        continue;
      }

      const category = String(t.category || 'Outros');
      totals[category] = (totals[category] || 0) + Math.abs(t.amount);
    }

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const dominance = entries[0] || null;

    if (!dominance) {
      return { dominance: null, share: 0 };
    }

    const totalExpenses = Object.values(totals).reduce((sum, value) => sum + value, 0);
    const share = totalExpenses > 0 ? dominance[1] / totalExpenses : 0;

    return {
      dominance,
      share,
    };
  }
}

export const financialPatternDetector = new FinancialPatternDetector();
