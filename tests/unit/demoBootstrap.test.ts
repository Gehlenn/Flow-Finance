import { beforeEach, describe, expect, it } from 'vitest';
import { calculateDashboardMetrics, buildDashboardReminderStateSummary } from '../../components/Dashboard';
import {
  createDemoProfileState,
  createDemoWorkspaceEntities,
  getDemoBootstrap,
  getDemoBootstrapPlan,
} from '../../src/demo/demoBootstrap';
import { generateWeeklyCashReport } from '../../src/finance/weeklyCashReview';
import { buildLocalCFOAnswer } from '../../services/geminiService';

describe('demo bootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('stays off without an explicit flag', () => {
    const storage = {
      getItem: () => null,
    };

    expect(getDemoBootstrap('?demoData=0', storage, true)).toBeNull();
    expect(getDemoBootstrap('', storage, false)).toBeNull();
  });

  it('parses explicit query and local overrides only when enabled', () => {
    const storage = {
      getItem: (key: string) => {
        if (key === 'flow_demo_data') {
          return '1';
        }

        if (key === 'flow_demo_user_name') {
          return 'Workspace Demo';
        }

        return null;
      },
    };

    const bootstrap = getDemoBootstrap(
      '?demoData=1&demoUserEmail=demo@example.test&demoWorkspaceId=ws-demo-check',
      storage,
      true,
    );

    expect(bootstrap).toMatchObject({
      userEmail: 'demo@example.test',
      userName: 'Workspace Demo',
      workspaceId: 'ws-demo-check',
      plan: 'pro',
    });
  });

  it('resolves the active demo plan from query or local storage', () => {
    window.history.pushState({}, '', '/?demoData=1&demoPlan=pro');
    expect(getDemoBootstrapPlan()).toBe('pro');

    window.history.pushState({}, '', '/?demoData=1&demoPlan=free');
    expect(getDemoBootstrapPlan()).toBe('free');

    window.history.pushState({}, '', '/');
    localStorage.setItem('flow_demo_data', '1');
    localStorage.setItem('flow_demo_plan', 'pro');
    expect(getDemoBootstrapPlan()).toBe('pro');
  });

  it('returns a deterministic service-business dataset for dashboard and cash review', () => {
    const referenceDate = new Date('2026-05-26T12:00:00.000Z');
    const demo = createDemoWorkspaceEntities({
      userId: 'demo-user',
      tenantId: 'tenant-demo-flow-finance',
      workspaceId: 'ws-demo-flow-finance',
      referenceDate,
    });
    const repeatedDemo = createDemoWorkspaceEntities({
      userId: 'demo-user',
      tenantId: 'tenant-demo-flow-finance',
      workspaceId: 'ws-demo-flow-finance',
      referenceDate,
    });

    const metrics = calculateDashboardMetrics(
      demo.transactions,
      demo.accounts,
      demo.reminders,
      createDemoProfileState().alerts.length,
      referenceDate,
      demo.receivables,
      true,
    );

    const reminderSummary = buildDashboardReminderStateSummary(demo.reminders, referenceDate, demo.receivables, true);
    const weeklyReport = generateWeeklyCashReport({
      transactions: demo.transactions,
      receivables: demo.receivables,
      referenceDate,
    });
    const localCfoAnswer = buildLocalCFOAnswer(
      'Qual e o risco do caixa nesta semana?',
      [
        'Confirmado (disponivel hoje): R$ 8.260,00',
        'Em 30 dias: R$ 7.020,00',
        'Vencido (atrasado): R$ 5.300,00',
        'Pendente (a confirmar): R$ 8.000,00',
        'CUSTO RECORRENTE: R$ 4.230,00',
        'META EM RISCO: Provisao de impostos do ciclo',
      ].join('\n'),
      'risk_question',
    );

    expect(repeatedDemo).toStrictEqual(demo);
    expect(demo.transactions).toHaveLength(14);
    expect(demo.reminders).toHaveLength(7);
    expect(demo.goals).toHaveLength(2);
    expect(demo.receivables.map((receivable) => receivable.status)).toEqual([
      'open',
      'overdue',
      'realized',
      'overdue',
      'open',
      'open',
      'open',
    ]);
    expect(demo.transactions.filter((transaction) => transaction.recurring)).toHaveLength(4);
    expect(demo.transactions.some((transaction) => /campanha|temporada|ciclo anterior/i.test(transaction.description))).toBe(true);
    expect(demo.transactions.some((transaction) => /Aluguel|Software|Impostos/i.test(transaction.description))).toBe(true);
    expect(demo.transactions.some((transaction) => /Retainer|Projeto|Workshop/i.test(transaction.description))).toBe(true);
    expect(demo.receivables.map((receivable) => receivable.customer_label)).toEqual(
      expect.arrayContaining(['Projeto Aurora', 'Cliente Retido', 'Cliente Delta', 'Cliente Norte', 'Projeto Orion']),
    );
    expect(demo.goals.map((goal) => goal.title)).toEqual([
      'Reserva operacional de 30 dias',
      'Provisao de impostos do ciclo',
    ]);
    expect(metrics.currentBalance).toBe(8260);
    expect(metrics.inflowMonth).toBe(19600);
    expect(metrics.outflowMonth).toBe(14250);
    expect(metrics.pendingRevenueMonth).toBe(8000);
    expect(metrics.overdueRevenueAmount).toBe(5300);
    expect(metrics.projectedRevenueMonth).toBe(13300);
    expect(metrics.confirmedRevenueMonth).toBe(19600);
    expect(metrics.activeAlerts).toBe(2);
    expect(reminderSummary.pendingCount).toBe(4);
    expect(reminderSummary.overdueCount).toBe(2);
    expect(reminderSummary.pendingAmount).toBe(27000);
    expect(reminderSummary.overdueAmount).toBe(5300);
    expect(reminderSummary.dueThisWeekCount).toBe(2);
    expect(weeklyReport.netConfirmedCash).toBe(-980);
    expect(weeklyReport.projectedReceivables).toBe(8000);
    expect(weeklyReport.overdueReceivables).toBe(5300);
    expect(weeklyReport.projectedWeekCash).toBe(7020);
    expect(weeklyReport.outcome).toBe('tight');
    expect(weeklyReport.risks).toEqual(expect.arrayContaining([
      'Saidas confirmadas superam entradas confirmadas na semana.',
      'Ha recebiveis vencidos afetando a leitura de caixa.',
    ]));
    expect(localCfoAnswer).toContain('Proxima acao');
    expect(localCfoAnswer).toContain('recebiveis atrasados R$ 5.300,00');
    expect(localCfoAnswer).not.toContain('=== DADOS');
  });
});
