import { describe, expect, it } from 'vitest';

import { buildFinancialContext } from '../../src/ai/aiCFO';
import { buildProductFinancialIntelligence } from '../../src/app/productFinancialIntelligence';
import { Account } from '../../models/Account';
import { Category, TransactionType, type Transaction } from '../../types';

describe('buildFinancialContext', () => {
  it('inclui bloco de contexto avançado quando inteligência enriquecida está disponível', () => {
    const accounts: Account[] = [
      {
        id: 'acc_1',
        user_id: 'u_1',
        name: 'Carteira',
        type: 'cash',
        balance: 3200,
        currency: 'BRL',
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ];

    const transactions: Transaction[] = [
      {
        id: '1',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-01-05T10:00:00.000Z',
        merchant: 'Consultorio',
      },
      {
        id: '2',
        amount: 120,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Netflix',
        date: '2026-01-10T10:00:00.000Z',
        merchant: 'Netflix',
      },
      {
        id: '3',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-02-05T10:00:00.000Z',
        merchant: 'Consultorio',
      },
      {
        id: '4',
        amount: 120,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Netflix',
        date: '2026-02-10T10:00:00.000Z',
        merchant: 'Netflix',
      },
      {
        id: '5',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-03-05T10:00:00.000Z',
        merchant: 'Consultorio',
      },
      {
        id: '6',
        amount: 120,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Netflix',
        date: '2026-03-10T10:00:00.000Z',
        merchant: 'Netflix',
      },
    ];

    const intelligence = buildProductFinancialIntelligence({
      userId: 'u_1',
      accounts,
      transactions,
    });

    const context = buildFinancialContext(
      accounts,
      transactions,
      {
        current_balance: 3200,
        balance_7_days: 3000,
        balance_30_days: 2600,
        projected_income: 5000,
        projected_expenses: 120,
      },
      [{
        id: 'i_1',
        user_id: 'u_1',
        type: 'saving',
        severity: 'low',
        message: 'Tudo sob controle.',
        created_at: '2026-03-16T00:00:00.000Z',
      }],
      'u_1',
      intelligence,
    );

    expect(context).toContain('=== CONTEXTO AVANCADO DE IA ===');
    expect(context).toContain('CONFIANCA GERAL');
    expect(context).toContain('PADROES RECORRENTES');
    expect(context).toContain('PERFIL FINANCEIRO ENGINE');
  });
});