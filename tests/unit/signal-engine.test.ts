import { afterEach, describe, expect, it, vi } from 'vitest';

import { computeFinancialSignals, signalsToInsights, signalsToRisks } from '../../src/ai/signalEngine';
import { Category, TransactionType, type Transaction } from '../../types';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? TransactionType.DESPESA,
    category: overrides.category ?? Category.PESSOAL,
    description: overrides.description ?? 'Teste',
    date: overrides.date ?? '2026-05-05T10:00:00.000Z',
    generated: overrides.generated ?? false,
    merchant: overrides.merchant,
    recurring: overrides.recurring,
  };
}

describe('signalEngine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a projected gap signal and converts it to risk/insight outputs', () => {
    const signals = computeFinancialSignals({
      transactions: [makeTransaction({ id: 'expense-1', amount: 200 })],
      prediction: {
        current_balance: 300,
        balance_7_days: 80,
        balance_30_days: -120,
        projected_income: 500,
        projected_expenses: 620,
      },
    });

    expect(signals.some((signal) => signal.kind === 'projected_gap')).toBe(true);
    expect(signalsToRisks(signals).some((risk) => risk.type === 'negative_forecast')).toBe(true);
    expect(signalsToInsights(signals).length).toBeGreaterThan(0);
  });

  it('detects subscription and fixed-expense signals from recurring patterns', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00.000Z'));

    const signals = computeFinancialSignals({
      transactions: [
        makeTransaction({
          id: 'sub-1',
          amount: 59.9,
          description: 'Netflix',
          merchant: 'Netflix',
          recurring: true,
          date: '2026-05-02T10:00:00.000Z',
        }),
        makeTransaction({
          id: 'sub-2',
          amount: 59.9,
          description: 'Spotify',
          merchant: 'Spotify',
          recurring: true,
          date: '2026-05-12T10:00:00.000Z',
        }),
        makeTransaction({
          id: 'sub-3',
          amount: 59.9,
          description: 'Netflix',
          merchant: 'Netflix',
          recurring: true,
          date: '2026-04-02T10:00:00.000Z',
        }),
        makeTransaction({
          id: 'sub-4',
          amount: 59.9,
          description: 'Netflix',
          merchant: 'Netflix',
          recurring: true,
          date: '2026-03-02T10:00:00.000Z',
        }),
      ],
      prediction: {
        current_balance: 1000,
        balance_7_days: 950,
        balance_30_days: 900,
        projected_income: 2000,
        projected_expenses: 800,
      },
    });

    expect(signals.some((signal) => signal.kind === 'subscription_detected')).toBe(true);
    expect(signals.some((signal) => signal.kind === 'fixed_expense_detected')).toBe(true);
  });
});
