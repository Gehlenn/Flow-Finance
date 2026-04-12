import { describe, expect, it } from 'vitest';
import {
  buildDashboardFocusNote,
  buildDashboardReminderStateSummary,
  calculateDashboardMetrics,
} from '../../components/Dashboard';
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
        id: 'r-overdue',
        title: 'Recebimento vencido',
        date: '2026-04-01T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 90,
        completed: false,
        priority: 'alta',
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
    expect(metrics.pendingRevenueMonth).toBe(300);
    expect(metrics.overdueRevenueAmount).toBe(90);
    expect(metrics.projectedRevenueMonth).toBe(390);
    expect(metrics.confirmedRevenueMonth).toBe(1000);
    expect(metrics.activeAlerts).toBe(2);
  });

  it('prioritizes overdue revenue in the focus note', () => {
    const note = buildDashboardFocusNote({
      currentBalance: 1750,
      inflowMonth: 500,
      outflowMonth: 200,
      projectedRevenueMonth: 1200,
      pendingRevenueMonth: 500,
      overdueRevenueAmount: 320,
      confirmedRevenueMonth: 700,
      activeAlerts: 0,
    });

    expect(note.title).toBe('Recebiveis vencidos pedem acao');
    expect(note.description).toContain('R$ 320,00');
  });

  it('falls back to alert review when there is no pending or overdue revenue', () => {
    const note = buildDashboardFocusNote({
      currentBalance: 1750,
      inflowMonth: 1000,
      outflowMonth: 800,
      projectedRevenueMonth: 700,
      pendingRevenueMonth: 0,
      overdueRevenueAmount: 0,
      confirmedRevenueMonth: 700,
      activeAlerts: 2,
    });

    expect(note.title).toBe('Alertas pedem revisao');
  });

  it('keeps pending and overdue calculations domain-agnostic even with extra metadata', () => {
    const referenceDate = new Date('2026-04-07T10:00:00.000Z');

    const reminders = [
      {
        id: 'r-1',
        title: 'Recebivel com metadado externo',
        date: '2026-04-10T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 320,
        completed: false,
        priority: 'media',
        source: 'clinic-automation',
      },
      {
        id: 'r-2',
        title: 'Recebivel fora do prazo com id externo',
        date: '2026-04-02T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 180,
        completed: false,
        priority: 'media',
        external_receivable_id: 'recv-2',
      },
      {
        id: 'r-3',
        title: 'Recebivel comum',
        date: '2026-04-12T09:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 999,
        completed: false,
        priority: 'media',
      },
    ] as Reminder[];

    const summary = buildDashboardReminderStateSummary(reminders, referenceDate);
    expect(summary.pendingCount).toBe(2);
    expect(summary.pendingAmount).toBe(1319);
    expect(summary.overdueCount).toBe(1);
    expect(summary.overdueAmount).toBe(180);
  });

  it('separates pending and overdue reminders for dashboard state reading', () => {
    const referenceDate = new Date('2026-04-07T10:00:00.000Z');

    const reminders: Reminder[] = [
      {
        id: 'pending-today',
        title: 'Recebimento hoje',
        date: '2026-04-07T12:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 200,
        completed: false,
        priority: 'alta',
      },
      {
        id: 'pending-week',
        title: 'Recebimento semana',
        date: '2026-04-10T12:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 350,
        completed: false,
        priority: 'media',
      },
      {
        id: 'overdue',
        title: 'Recebimento vencido',
        date: '2026-04-03T12:00:00.000Z',
        type: ReminderType.NEGOCIO,
        amount: 125,
        completed: false,
        priority: 'alta',
      },
    ];

    const summary = buildDashboardReminderStateSummary(reminders, referenceDate);

    expect(summary.pendingCount).toBe(2);
    expect(summary.pendingAmount).toBe(550);
    expect(summary.overdueCount).toBe(1);
    expect(summary.overdueAmount).toBe(125);
    expect(summary.dueTodayCount).toBe(1);
    expect(summary.dueThisWeekCount).toBe(2);
  });
});
