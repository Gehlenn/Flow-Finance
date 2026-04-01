import { describe, it, expect } from 'vitest';
import { toDomainTransaction, toApiTransaction, toDomainAccount, toApiAccount, toDomainReminder, toApiReminder } from '../../src/utils/typeMappers';
import { TransactionType, Category, ReminderType } from '../../types';

describe('typeMappers', () => {
  it('converte Transaction API <-> Domain', () => {
    const api = {
      id: 'tx1',
      amount: 100,
      type: 'Receita',
      category: 'Pessoal',
      description: 'Salário',
      date: '2026-03-20T00:00:00.000Z',
      account_id: 'acc1',
      merchant: 'Empresa',
      payment_method: 'pix',
      source: 'manual',
      confidence_score: 0.99,
      receipt_image: 'img',
      recurring: false,
      recurrence_type: 'monthly',
      recurrence_interval: 1,
      generated: false,
    };
    const domain = toDomainTransaction(api);
    expect(domain).toMatchObject({
      id: 'tx1',
      amount: 100,
      type: TransactionType.RECEITA,
      category: Category.PESSOAL,
      description: 'Salário',
      date: '2026-03-20T00:00:00.000Z',
      account_id: 'acc1',
      merchant: 'Empresa',
      payment_method: 'pix',
      source: 'manual',
      confidence_score: 0.99,
      receipt_image: 'img',
      recurring: false,
      recurrence_type: 'monthly',
      recurrence_interval: 1,
      generated: false,
    });
    expect(toApiTransaction(domain)).toMatchObject(api);
  });

  it('converte Account API <-> Domain', () => {
    const api = {
      id: 'acc1',
      user_id: 'user1',
      name: 'Conta',
      type: 'checking',
      balance: 500,
      currency: 'BRL',
      created_at: '2026-03-20T00:00:00.000Z',
    };
    const domain = toDomainAccount(api);
    expect(domain).toMatchObject({
      id: 'acc1',
      user_id: 'user1',
      name: 'Conta',
      type: 'checking',
      balance: 500,
      currency: 'BRL',
      created_at: '2026-03-20T00:00:00.000Z',
    });
    expect(toApiAccount(domain)).toMatchObject(api);
  });

  it('converte Reminder API <-> Domain', () => {
    const api = {
      id: 'rem1',
      title: 'Pagar conta',
      date: '2026-03-20T00:00:00.000Z',
      type: 'Pessoal',
      amount: 200,
      completed: false,
      priority: 'baixa',
      isRecurring: false,
    };
    const domain = toDomainReminder(api);
    expect(domain).toMatchObject({
      id: 'rem1',
      title: 'Pagar conta',
      date: '2026-03-20T00:00:00.000Z',
      type: ReminderType.PESSOAL,
      amount: 200,
      completed: false,
      priority: 'baixa',
      isRecurring: false,
    });
    expect(toApiReminder(domain)).toMatchObject(api);
  });
});
