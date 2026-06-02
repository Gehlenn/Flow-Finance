import { afterEach, describe, expect, it, vi } from 'vitest';

import { expandTransactionsWithRecurring, generateRecurringTransactions } from '../../src/finance/recurringService';
import { Category, TransactionType, type Transaction } from '../../types';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    amount: 100,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Assinatura',
    date: '2026-04-10',
    recurring: true,
    recurrence_type: 'monthly',
    recurrence_interval: 1,
    confidence_score: 0.9,
    ...overrides,
  } as Transaction;
}

describe('recurringService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves date-only recurring transactions as local dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));

    const generated = generateRecurringTransactions(
      [makeTx()],
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-06-30T23:59:59.999Z'),
    );

    expect(generated.length).toBeGreaterThan(0);
    expect(generated.every((tx) => /^\d{4}-\d{2}-\d{2}$/.test(tx.date))).toBe(true);
  });

  it('skips malformed recurring dates without crashing', () => {
    const generated = generateRecurringTransactions(
      [makeTx({ id: 'bad', date: 'not-a-date' })],
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-06-30T23:59:59.999Z'),
    );

    expect(generated).toHaveLength(0);
  });

  it('expands recurring transactions without mutating original availability', () => {
    const expanded = expandTransactionsWithRecurring(
      [makeTx({ id: 'base', date: '2026-04-10', description: 'Base' })],
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-06-30T23:59:59.999Z'),
    );

    expect(expanded.some((tx) => tx.id === 'base')).toBe(true);
  });
});
