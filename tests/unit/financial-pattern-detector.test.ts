import { describe, expect, it } from 'vitest';
import { FinancialPatternDetector } from '../../src/engines/finance/patternDetector/financialPatternDetector';
import { Category, TransactionType, type Transaction } from '../../types';

function expense(id: string, amount: number, merchant: string, date: string, category: Category = Category.PESSOAL): Transaction {
  return {
    id,
    amount,
    type: TransactionType.DESPESA,
    category,
    description: merchant,
    merchant,
    date,
  };
}

describe('FinancialPatternDetector', () => {
  it('detects recurring expenses, weekly spikes, and category dominance', () => {
    const detector = new FinancialPatternDetector();

    const transactions: Transaction[] = [
      expense('1', 59.9, 'Netflix', '2026-01-04T10:00:00.000Z'),
      expense('2', 59.9, 'Netflix', '2026-02-08T10:00:00.000Z'),
      expense('3', 59.9, 'Netflix', '2026-03-08T10:00:00.000Z'),
      expense('4', 30, 'Cafe', '2026-03-09T10:00:00.000Z'),
      expense('5', 70, 'Mercado', '2026-03-15T10:00:00.000Z', Category.PESSOAL),
      expense('6', 100, 'Uber', '2026-03-16T10:00:00.000Z', Category.PESSOAL),
    ];

    const patterns = detector.detectPatterns(transactions);

    expect(patterns.recurring.length).toBeGreaterThan(0);
    expect(patterns.weeklySpikes.length).toBeGreaterThan(0);
    expect(patterns.categoryDominance?.[0]).toBe(Category.PESSOAL);
  });
});
