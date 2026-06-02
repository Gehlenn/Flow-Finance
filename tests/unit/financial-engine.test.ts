import { afterEach, describe, expect, it, vi } from 'vitest';

import { runFinancialEngine } from '../../src/ai/financialEngine';
import { Category, TransactionType, type Transaction } from '../../types';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? TransactionType.RECEITA,
    category: overrides.category ?? Category.PESSOAL,
    description: overrides.description ?? 'Receita',
    date: overrides.date ?? '2026-04-10',
    source: overrides.source ?? 'manual',
    generated: overrides.generated ?? false,
    confidence_score: overrides.confidence_score ?? 1,
    account_id: overrides.account_id ?? 'acc-1',
    merchant: overrides.merchant,
  };
}

describe('financialEngine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trata datas-only como mes local e ignora datas invalidas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));

    const state = runFinancialEngine([
      makeTransaction({ id: 'current', date: '2026-04-10' }),
      makeTransaction({ id: 'invalid', date: 'invalid-date', amount: 50 }),
      makeTransaction({ id: 'previous', date: '2026-03-10', amount: -25, type: TransactionType.DESPESA }),
    ]);

    expect(state.summary_current_month.income).toBe(100);
    expect(state.summary_current_month.expenses).toBe(0);
    expect(state.summary_last_month.expenses).toBe(-25);
    expect(state.all_transactions.length).toBe(2);
  });

  it('mantem transacoes date-only dentro do resumo mensal correto', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));

    const state = runFinancialEngine([
      makeTransaction({ id: 'current', date: '2026-04-10' }),
      makeTransaction({ id: 'current-2', date: '2026-04-11', amount: 30, type: TransactionType.DESPESA }),
    ]);

    expect(state.summary_current_month.income).toBe(100);
    expect(state.summary_current_month.expenses).toBe(30);
  });
});
