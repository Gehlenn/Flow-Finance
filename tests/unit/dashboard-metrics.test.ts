import { describe, expect, it } from 'vitest';
import { calculateDashboardMetrics } from '../../components/Dashboard';
import { Account } from '../../models/Account';
import { Category, ReminderType, TransactionType, type Reminder, type Transaction } from '../../types';

describe('dashboard metrics', () => {
  it('calculates current balance, month inflow/outflow and projected revenue', () => {
    const referenceDate = new Date('2026-04-07T10:00:00.000Z');

    const accounts: Account[] = [
      {
        id: 'acc-1',
        user_id: 'user-1',
        name: 'Conta Principal',
        type: 'bank',
        balance: 1500,
        currency: 'BRL',
        created_at: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'acc-2',
        user_id: 'user-1',
        name: 'Carteira',
        type: 'cash',
        balance: 250,
        currency: 'BRL',
        created_at: '2026-04-01T00:00:00.000Z',
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 't1',
        amount: 1000,
        type: TransactionType.RECEITA,
        category: Category.NEGOCIO,
        description: 'Receita confirmada 1',
        date: '2026-04-02T12:00:00.000Z',
      },
      {
        id: 't2',
        amount: 200,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Despesa do mês',
        date: '2026-04-03T12:00:00.000Z',
      },
      {
        id: 't3',
        amount: 999,
        type: TransactionType.RECEITA,
        category: Category.NEGOCIO,
        description: 'Receita de outro mês',
        date: '2026-03-20T12:00:00.000Z',
      },
    ];

    const reminders: Reminder[] = [
      {
        id: 'r1',
        title: 'Recebimento previsto',
        date: '2026-04-10T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 300,
        completed: false,
        priority: 'media',
      },
      {
        id: 'r2',
        title: 'Recebimento concluído',
        date: '2026-04-11T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 150,
        completed: true,
        priority: 'media',
      },
      {
        id: 'r3',
        title: 'Outro mês',
        date: '2026-05-01T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 800,
        completed: false,
        priority: 'media',
      },
    ];

    const metrics = calculateDashboardMetrics(transactions, accounts, reminders, 2, referenceDate);

    expect(metrics.currentBalance).toBe(1750);
    expect(metrics.inflowMonth).toBe(1000);
    expect(metrics.outflowMonth).toBe(200);
    expect(metrics.projectedRevenueMonth).toBe(300);
    expect(metrics.confirmedRevenueMonth).toBe(1000);
    expect(metrics.activeAlerts).toBe(2);
  });
});
