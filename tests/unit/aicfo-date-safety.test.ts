import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildFinancialContext } from '../../src/ai/aiCFO';
import { Category, TransactionType, type Transaction } from '../../types';
import { type Account } from '../../models/Account';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? TransactionType.RECEITA,
    category: overrides.category ?? Category.NEGOCIO,
    description: overrides.description ?? 'Receita',
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

describe('aiCFO', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trata datas-only como locais no resumo mensal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));

    const context = buildFinancialContext(
      [makeAccount({ balance: 5000 })],
      [
        makeTransaction({ id: 'income-1', amount: 1000, type: TransactionType.RECEITA, date: '2026-04-10' }),
        makeTransaction({ id: 'expense-1', amount: 250, type: TransactionType.DESPESA, date: '2026-04-10' }),
        makeTransaction({ id: 'invalid', amount: 9999, type: TransactionType.RECEITA, date: 'invalid-date' }),
      ],
      {
        balance_7_days: 0,
        balance_30_days: 0,
        current_balance: 0,
        projected_expenses: 0,
        projected_income: 0,
      },
      [],
      'user-1',
    );

    expect(context).toContain('MÊS ATUAL:');
    expect(context).toContain('Receitas: R$');
    expect(context).toContain('1.000,00');
    expect(context).toContain('Despesas: R$');
    expect(context).toContain('250,00');
  });
});
