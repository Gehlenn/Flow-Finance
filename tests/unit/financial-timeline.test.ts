import { describe, expect, it } from 'vitest';
import { buildFinancialTimeline } from '../../src/engines/finance/financialTimeline';
import { Category, TransactionType, type Transaction } from '../../types';

describe('buildFinancialTimeline', () => {
  it('builds timeline and running balance evolution', () => {
    const transactions: Transaction[] = [
      {
        id: '1', amount: 1000, type: TransactionType.RECEITA, category: Category.CONSULTORIO,
        description: 'Income', date: '2026-03-01T10:00:00.000Z',
      },
      {
        id: '2', amount: 200, type: TransactionType.DESPESA, category: Category.PESSOAL,
        description: 'Expense', date: '2026-03-02T10:00:00.000Z',
      },
      {
        id: '3', amount: 150, type: TransactionType.DESPESA, category: Category.PESSOAL,
        description: 'Expense2', date: '2026-03-02T20:00:00.000Z',
      },
    ];

    const timeline = buildFinancialTimeline(transactions);

    expect(timeline.points.length).toBe(2);
    expect(timeline.totals.income).toBe(1000);
    expect(timeline.totals.expenses).toBe(350);
    expect(timeline.totals.finalBalance).toBe(650);
  });
});
