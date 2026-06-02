import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectFixedExpenses, formatExpenseCategory } from '../../src/ai/fixedExpenseDetector';
import { Category, TransactionType, type Transaction } from '../../types';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? TransactionType.DESPESA,
    category: overrides.category ?? Category.PESSOAL,
    description: overrides.description ?? 'Despesa fixa',
    date: overrides.date ?? '2026-04-10',
    source: overrides.source ?? 'manual',
    generated: overrides.generated ?? false,
    confidence_score: overrides.confidence_score ?? 1,
    account_id: overrides.account_id ?? 'acc-1',
    merchant: overrides.merchant,
  };
}

describe('fixedExpenseDetector', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trata datas-only como locais e gera next_expected local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));

    const report = detectFixedExpenses([
      makeTransaction({ id: 'rent-1', amount: 1200, description: 'Aluguel abril', merchant: 'Aluguel', date: '2026-03-10' }),
      makeTransaction({ id: 'rent-2', amount: 1200, description: 'Aluguel maio', merchant: 'Aluguel', date: '2026-04-10' }),
      makeTransaction({ id: 'noise', amount: 80, description: 'Lanche', merchant: 'Snack', date: 'invalid-date' }),
    ]);

    expect(report.expenses).toHaveLength(1);
    expect(report.expenses[0].day_of_month).toBe(10);
    expect(report.expenses[0].next_expected).toBe('2026-05-10');
    expect(report.expenses[0].last_date).toBe('2026-04-10');
    expect(report.total_monthly).toBe(1200);
    expect(formatExpenseCategory(report.expenses[0].category)).toBe('Moradia');
  });
});
