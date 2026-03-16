import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/errors/AppError';
import { validateTransactionInput } from '../../src/validators/transactionValidator';
import { validateGoalInput } from '../../src/validators/goalValidator';

describe('AppError', () => {
  it('deve manter statusCode e details', () => {
    const error = new AppError('Invalid payload', 422, { field: 'amount' });

    expect(error.message).toBe('Invalid payload');
    expect(error.statusCode).toBe(422);
    expect(error.details).toEqual({ field: 'amount' });
  });
});

describe('transactionValidator', () => {
  it('deve validar transação válida sem lançar erro', () => {
    expect(() => validateTransactionInput({
      accountId: 'acc_1',
      amount: 100,
      category: 'food',
      date: new Date('2026-03-14T00:00:00.000Z'),
      description: 'Mercado',
      isGenerated: false,
      source: 'manual',
      type: 'expense',
      merchant: 'Supermercado',
    })).not.toThrow();
  });

  it('deve lançar AppError para amount inválido', () => {
    expect(() => validateTransactionInput({
      accountId: 'acc_1',
      amount: 0,
      category: 'food',
      date: new Date('2026-03-14T00:00:00.000Z'),
      description: 'Mercado',
      isGenerated: false,
      source: 'manual',
      type: 'expense',
      merchant: 'Supermercado',
    })).toThrow(AppError);
  });
});

describe('goalValidator', () => {
  it('deve validar meta válida sem lançar erro', () => {
    expect(() => validateGoalInput({
      color: '#22c55e',
      currentAmount: 500,
      icon: 'target',
      name: 'Reserva',
      targetAmount: 5000,
      targetDate: new Date('2026-12-01T00:00:00.000Z'),
    })).not.toThrow();
  });

  it('deve lançar AppError para targetAmount inválido', () => {
    expect(() => validateGoalInput({
      color: '#22c55e',
      currentAmount: 500,
      icon: 'target',
      name: 'Reserva',
      targetAmount: 0,
      targetDate: new Date('2026-12-01T00:00:00.000Z'),
    })).toThrow(AppError);
  });
});
