import { describe, expect, it } from 'vitest';

import { buildAdvancedAIContext } from '../../src/engines/ai/contextBuilder/advancedContextBuilder';
import { Category, TransactionType, type Transaction } from '../../types';

function tx(input: Transaction): Transaction {
  return input;
}

describe('buildAdvancedAIContext', () => {
  it('retorna contexto avançado com qualidade de dados e confiança', () => {
    const transactions: Transaction[] = [
      tx({
        id: '1',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-03-01T10:00:00.000Z',
      }),
      tx({
        id: '2',
        amount: 59.9,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Netflix',
        merchant: 'Netflix',
        date: '2026-01-08T10:00:00.000Z',
      }),
      tx({
        id: '3',
        amount: 59.9,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Netflix',
        merchant: 'Netflix',
        date: '2026-02-08T10:00:00.000Z',
      }),
      tx({
        id: '4',
        amount: 59.9,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Netflix',
        merchant: 'Netflix',
        date: '2026-03-08T10:00:00.000Z',
      }),
      tx({
        id: '5',
        amount: 600,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Viagem',
        date: '2026-03-15T10:00:00.000Z',
      }),
    ];

    const context = buildAdvancedAIContext(
      {
        userId: 'u_ctx',
        accounts: ['acc_1'],
        timezone: 'UTC',
        currency: 'BRL',
      },
      transactions
    );

    expect(context.recentTransactions.length).toBeLessThanOrEqual(10);
    expect(context.dataQuality.transactionCount).toBe(5);
    expect(context.dataQuality.merchantCoverage).toBeGreaterThan(0);
    expect(context.confidence.overall).toBeGreaterThan(0);
    expect(context.patterns.recurringInsights.length).toBeGreaterThan(0);
    expect(context.dominantCategory?.category).toBe(Category.PESSOAL);
  });

  it('mantem ordenacao decrescente em recentTransactions', () => {
    const transactions: Transaction[] = [
      tx({
        id: 'older',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Older',
        date: '2026-01-01T10:00:00.000Z',
      }),
      tx({
        id: 'newer',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Newer',
        date: '2026-03-01T10:00:00.000Z',
      }),
    ];

    const context = buildAdvancedAIContext(
      {
        userId: 'u_ctx_order',
        accounts: ['acc_1'],
        timezone: 'UTC',
        currency: 'BRL',
      },
      transactions
    );

    expect(context.recentTransactions[0].id).toBe('newer');
    expect(context.recentTransactions[1].id).toBe('older');
  });
});
