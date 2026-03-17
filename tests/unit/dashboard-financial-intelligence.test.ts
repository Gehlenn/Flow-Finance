import { describe, expect, it } from 'vitest';

import { Account } from '../../models/Account';
import { buildDashboardFinancialIntelligence } from '../../src/app/dashboardFinancialIntelligence';
import { Category, TransactionType, type Transaction } from '../../types';

function tx(input: Transaction): Transaction {
  return input;
}

describe('buildDashboardFinancialIntelligence', () => {
  it('agrega contexto avançado para consumo do Dashboard', () => {
    const accounts: Account[] = [
      {
        id: 'acc_1',
        user_id: 'user_1',
        name: 'Carteira',
        type: 'cash',
        balance: 2400,
        currency: 'BRL',
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ];

    const transactions: Transaction[] = [
      tx({
        id: '1',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita principal',
        date: '2026-01-05T10:00:00.000Z',
        merchant: 'Consultorio',
      }),
      tx({
        id: '2',
        amount: 450,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        date: '2026-01-10T10:00:00.000Z',
        merchant: 'Mercado Bom',
      }),
      tx({
        id: '3',
        amount: 59.9,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Streaming',
        date: '2026-01-12T10:00:00.000Z',
        merchant: 'Netflix',
      }),
      tx({
        id: '4',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita principal',
        date: '2026-02-05T10:00:00.000Z',
        merchant: 'Consultorio',
      }),
      tx({
        id: '5',
        amount: 59.9,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Streaming',
        date: '2026-02-12T10:00:00.000Z',
        merchant: 'Netflix',
      }),
      tx({
        id: '6',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita principal',
        date: '2026-03-05T10:00:00.000Z',
        merchant: 'Consultorio',
      }),
      tx({
        id: '7',
        amount: 59.9,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Streaming',
        date: '2026-03-12T10:00:00.000Z',
        merchant: 'Netflix',
      }),
      tx({
        id: '8',
        amount: 900,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Viagem',
        date: '2026-03-15T10:00:00.000Z',
      }),
    ];

    const result = buildDashboardFinancialIntelligence({
      userId: 'user_1',
      accounts,
      transactions,
    });

    expect(result.context.base.userId).toBe('user_1');
    expect(result.context.base.accounts).toEqual(['acc_1']);
    expect(result.context.base.financialProfile.profile).not.toBe('Undefined');
    expect(result.merchantCoveragePercent).toBeGreaterThan(70);
    expect(result.recurringCount).toBeGreaterThan(0);
    expect(result.dominantCategoryLabel).toBe(Category.PESSOAL);
    expect(result.context.confidence.overall).toBeGreaterThan(0);
  });

  it('usa fallback local quando userId nao e informado', () => {
    const result = buildDashboardFinancialIntelligence({
      transactions: [],
    });

    expect(result.context.base.userId).toBe('local');
    expect(result.context.base.accounts).toEqual([]);
    expect(result.merchantCoveragePercent).toBe(0);
    expect(result.recurringCount).toBe(0);
  });
});