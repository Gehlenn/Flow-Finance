import { describe, expect, it } from 'vitest';
import { calculateDashboardMetrics } from '../../components/Dashboard';
import { Account } from '../../models/Account';
import { Category, ReminderType, TransactionType, type Reminder, type Transaction } from '../../types';

const referenceDate = new Date('2026-04-15T10:00:00.000Z');

function centsToMoney(cents: number): number {
  return cents / 100;
}

describe('dashboard money math invariants', () => {
  it('keeps dashboard aggregates aligned with integer-cent reference sums', () => {
    const accounts: Account[] = [
      {
        id: 'acc-1',
        user_id: 'user-1',
        name: 'Conta principal',
        type: 'bank',
        balance: 1234.56,
        currency: 'BRL',
        created_at: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'acc-2',
        user_id: 'user-1',
        name: 'Reserva',
        type: 'cash',
        balance: 789.45,
        currency: 'BRL',
        created_at: '2026-04-01T00:00:00.000Z',
      },
    ];

    const transactions: Transaction[] = Array.from({ length: 100 }, (_, index) => {
      const amountInCents = 1001 + (index * 37);
      const day = String((index % 20) + 1).padStart(2, '0');
      const isIncome = index % 3 !== 0;

      return {
        id: `tx-${index}`,
        amount: centsToMoney(amountInCents),
        type: isIncome ? TransactionType.RECEITA : TransactionType.DESPESA,
        category: isIncome ? Category.NEGOCIO : Category.PESSOAL,
        description: `Transacao ${index}`,
        date: `2026-04-${day}T12:00:00.000Z`,
      };
    });

    const reminders: Reminder[] = [
      {
        id: 'rem-pending-1',
        title: 'Recebivel pendente 1',
        date: '2026-04-18T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 111.11,
        completed: false,
        priority: 'media',
      },
      {
        id: 'rem-pending-2',
        title: 'Recebivel pendente 2',
        date: '2026-04-21T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 222.22,
        completed: false,
        priority: 'alta',
      },
      {
        id: 'rem-overdue',
        title: 'Recebivel vencido',
        date: '2026-04-03T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 333.33,
        completed: false,
        priority: 'alta',
      },
    ];

    const metrics = calculateDashboardMetrics(transactions, accounts, reminders, 4, referenceDate);

    const expectedBalanceCents = Math.round(accounts[0].balance * 100) + Math.round(accounts[1].balance * 100);
    const expectedInflowCents = transactions
      .filter((transaction) => transaction.type === TransactionType.RECEITA)
      .reduce((sum, transaction) => sum + Math.round(transaction.amount * 100), 0);
    const expectedOutflowCents = transactions
      .filter((transaction) => transaction.type === TransactionType.DESPESA)
      .reduce((sum, transaction) => sum + Math.round(transaction.amount * 100), 0);
    const expectedPendingCents = reminders
      .filter((reminder) => new Date(reminder.date).getTime() >= new Date('2026-04-15T00:00:00.000Z').getTime())
      .reduce((sum, reminder) => sum + Math.round((reminder.amount || 0) * 100), 0);
    const expectedOverdueCents = reminders
      .filter((reminder) => new Date(reminder.date).getTime() < new Date('2026-04-15T00:00:00.000Z').getTime())
      .reduce((sum, reminder) => sum + Math.round((reminder.amount || 0) * 100), 0);

    expect(metrics.currentBalance).toBe(centsToMoney(expectedBalanceCents));
    expect(metrics.inflowMonth).toBe(centsToMoney(expectedInflowCents));
    expect(metrics.outflowMonth).toBe(centsToMoney(expectedOutflowCents));
    expect(metrics.pendingRevenueMonth).toBe(centsToMoney(expectedPendingCents));
    expect(metrics.overdueRevenueAmount).toBe(centsToMoney(expectedOverdueCents));
    expect(metrics.projectedRevenueMonth).toBe(centsToMoney(expectedPendingCents + expectedOverdueCents));
    expect(metrics.confirmedRevenueMonth).toBe(centsToMoney(expectedInflowCents));
  });
});
