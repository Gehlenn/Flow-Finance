import { describe, expect, it } from 'vitest';
import { moneyMapEngine } from '../../src/engines/finance/moneyMap/moneyMapEngine';
import { Category, TransactionType } from '../../types';

describe('moneyMapEngine', () => {
  it('calculates category distribution for expenses', () => {
    const distribution = moneyMapEngine.generate([
      {
        id: 't1',
        amount: 350,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        date: new Date().toISOString(),
      },
      {
        id: 't2',
        amount: 250,
        type: TransactionType.DESPESA,
        category: Category.CONSULTORIO,
        description: 'Combustivel',
        date: new Date().toISOString(),
      },
      {
        id: 't3',
        amount: 400,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Restaurante',
        date: new Date().toISOString(),
      },
    ]);

    expect(distribution[0].category).toBe(Category.PESSOAL);
    expect(Math.round(distribution[0].percentage)).toBe(75);
    expect(Math.round(distribution[1].percentage)).toBe(25);
  });
});