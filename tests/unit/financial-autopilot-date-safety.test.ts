import { afterEach, describe, expect, it, vi } from 'vitest';

import { runFinancialAutopilot } from '../../src/ai/financialAutopilot';
import { Category, TransactionType, type Transaction } from '../../types';
import { type Account } from '../../models/Account';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 20,
    type: overrides.type ?? TransactionType.DESPESA,
    category: overrides.category ?? Category.PESSOAL,
    description: overrides.description ?? 'Delivery',
    date: overrides.date ?? '2026-04-10',
    source: overrides.source ?? 'manual',
    generated: overrides.generated ?? false,
    confidence_score: overrides.confidence_score ?? 1,
    account_id: overrides.account_id ?? 'acc-1',
    merchant: overrides.merchant,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: overrides.id || 'acc-1',
    user_id: overrides.user_id || 'user-1',
    name: overrides.name || 'Conta',
    type: overrides.type || 'cash',
    balance: overrides.balance ?? 0,
    currency: overrides.currency || 'BRL',
    created_at: overrides.created_at || '2026-04-01T00:00:00.000Z',
  } as Account;
}

describe('financialAutopilot', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trata datas-only como locais ao calcular microgastos recentes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));

    const actions = runFinancialAutopilot(
      [makeAccount()],
      [
        makeTransaction({ id: 'recent-1', amount: 20, description: 'Cafe', merchant: 'Cafe', date: '2026-04-10' }),
        makeTransaction({ id: 'recent-2', amount: 20, description: 'Cafe', merchant: 'Cafe', date: '2026-04-11' }),
        makeTransaction({ id: 'recent-3', amount: 20, description: 'Cafe', merchant: 'Cafe', date: '2026-04-12' }),
        makeTransaction({ id: 'recent-4', amount: 20, description: 'Cafe', merchant: 'Cafe', date: '2026-04-13' }),
        makeTransaction({ id: 'recent-5', amount: 20, description: 'Cafe', merchant: 'Cafe', date: '2026-04-14' }),
        makeTransaction({ id: 'recent-6', amount: 20, description: 'Cafe', merchant: 'Cafe', date: '2026-04-15' }),
        makeTransaction({ id: 'recent-7', amount: 20, description: 'Cafe', merchant: 'Cafe', date: '2026-04-16' }),
        makeTransaction({ id: 'recent-8', amount: 20, description: 'Cafe', merchant: 'Cafe', date: '2026-04-17' }),
        makeTransaction({ id: 'old-1', amount: 20, description: 'Cafe', merchant: 'Cafe', date: 'invalid-date' }),
      ],
      {
        balance_7_days: 0,
        balance_30_days: 0,
        current_balance: 0,
        projected_expenses: 0,
        projected_income: 0,
      },
      [],
    );

    expect(actions.some(action => action.title === 'Microgastos acumulados')).toBe(true);
  });

  it('usa budget inteligente mesmo sem historico para sinalizar categoria excessiva', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));

    const actions = runFinancialAutopilot(
      [makeAccount({ balance: 250 })],
      [
        makeTransaction({
          id: 'income-1',
          amount: 1000,
          type: TransactionType.RECEITA,
          category: Category.NEGOCIO,
          description: 'Receita',
          merchant: 'Cliente',
          date: '2026-05-02T10:00:00.000Z',
        }),
        makeTransaction({
          id: 'expense-1',
          amount: 900,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Despesa pessoal',
          merchant: 'Mercado',
          date: '2026-05-10T12:00:00.000Z',
        }),
      ],
      {
        balance_7_days: 0,
        balance_30_days: 0,
        current_balance: 250,
        projected_expenses: 900,
        projected_income: 1000,
      },
      [],
    );

    expect(actions.some((action) => action.title === 'Gasto excessivo em Pessoal')).toBe(true);
  });
});
