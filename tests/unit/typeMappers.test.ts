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
      description: 'Salario',
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
      description: 'Salario',
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

  it('mantem date-only de transaction como data local no mapper', () => {
    const api = {
      id: 'tx2',
      amount: 120,
      type: 'Despesa',
      category: 'Pessoal',
      description: 'Mercado',
      date: '2026-03-20',
    };

    const domain = toDomainTransaction(api);
    expect(domain.date).toBe('2026-03-20');
    expect(toApiTransaction(domain)).toMatchObject(api);
  });

  it('converte Account API <-> Domain', () => {
    const api = {
      id: 'acc1',
      user_id: 'user1',
      name: 'Conta',
      type: 'cash',
      balance: 500,
      currency: 'BRL',
      created_at: '2026-03-20T00:00:00.000Z',
    };
    const domain = toDomainAccount(api);
    expect(domain).toMatchObject({
      id: 'acc1',
      user_id: 'user1',
      name: 'Conta',
      type: 'cash',
      balance: 500,
      currency: 'BRL',
      created_at: '2026-03-20T00:00:00.000Z',
    });
    expect(toApiAccount(domain)).toMatchObject(api);
  });

  it('normaliza createdAt para ISO e aceita date-only no account mapper', () => {
    const api = {
      id: 'acc2',
      user_id: 'user2',
      name: 'Conta',
      type: 'cash',
      balance: 500,
      currency: 'BRL',
      createdAt: '2026-03-20',
    };

    const domain = toDomainAccount(api);
    expect(domain.created_at).toBe('2026-03-20');
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

  it('mantem date-only de reminder como data local no mapper', () => {
    const api = {
      id: 'rem2',
      title: 'Pagar conta',
      date: '2026-03-20',
      type: 'Pessoal',
      amount: 200,
      completed: false,
      priority: 'baixa',
      isRecurring: false,
    };

    const domain = toDomainReminder(api);
    expect(domain.date).toBe('2026-03-20');
    expect(toApiReminder(domain)).toMatchObject(api);
  });

  it('normaliza datas invalidas de transaction e reminder para ISO atual', () => {
    const tx = toDomainTransaction({
      id: 'tx-invalid',
      amount: 10,
      type: 'Despesa',
      category: 'Pessoal',
      description: 'Teste',
      date: 'invalid-date',
    });

    const reminder = toDomainReminder({
      id: 'rem-invalid',
      title: 'Teste',
      date: 'invalid-date',
      type: 'Pessoal',
      amount: 1,
    });

    expect(new Date(tx.date).getTime()).not.toBeNaN();
    expect(new Date(reminder.date).getTime()).not.toBeNaN();
  });
});

