import { describe, expect, it } from 'vitest';
import { cashflowPredictionEngine } from '../../src/engines/finance/cashflowPrediction/cashflowPredictionEngine';
import { Category, TransactionType } from '../../types';

describe('cashflowPredictionEngine', () => {
  it('projects 7, 30 and 90 day balances from recurring expenses', () => {
    const forecast = cashflowPredictionEngine.predict({
      balance: 5000,
      transactions: [
        {
          id: 'income-1',
          amount: 5000,
          type: TransactionType.RECEITA,
          category: Category.CONSULTORIO,
          description: 'Salario',
          date: '2026-01-05T00:00:00.000Z',
        },
        {
          id: 'rent-1',
          amount: 1000,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Aluguel',
          merchant: 'Imobiliaria XPTO',
          date: '2026-01-10T00:00:00.000Z',
        },
        {
          id: 'rent-2',
          amount: 1000,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Aluguel',
          merchant: 'Imobiliaria XPTO',
          date: '2026-02-10T00:00:00.000Z',
        },
        {
          id: 'rent-3',
          amount: 1000,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Aluguel',
          merchant: 'Imobiliaria XPTO',
          date: '2026-03-10T00:00:00.000Z',
        },
      ],
    });

    expect(forecast.currentBalance).toBe(5000);
    expect(forecast.in7Days).toBe(5000);
    expect(forecast.in30Days).toBe(4000);
    expect(forecast.in90Days).toBe(2000);
  });
});