import { beforeEach, describe, expect, it } from 'vitest';
import { calculateDashboardMetrics, buildDashboardReminderStateSummary } from '../../components/Dashboard';
import {
  createDemoProfileState,
  createDemoWorkspaceEntities,
  getDemoBootstrap,
  getDemoBootstrapPlan,
} from '../../src/demo/demoBootstrap';

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

  it('returns coherent transactions, receivables and reminder metrics for the dashboard', () => {
    const referenceDate = new Date('2026-05-26T12:00:00.000Z');
    const demo = createDemoWorkspaceEntities({
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
      false,
    );

    const reminderSummary = buildDashboardReminderStateSummary(demo.reminders, referenceDate, demo.receivables, false);

    expect(demo.transactions).toHaveLength(4);
    expect(demo.receivables.map((receivable) => receivable.status)).toEqual([
      'open',
      'overdue',
      'realized',
    ]);
    expect(metrics.currentBalance).toBe(16260);
    expect(metrics.inflowMonth).toBe(12800);
    expect(metrics.outflowMonth).toBe(2810);
    expect(metrics.pendingRevenueMonth).toBe(5400);
    expect(metrics.overdueRevenueAmount).toBe(1900);
    expect(metrics.projectedRevenueMonth).toBe(7300);
    expect(metrics.confirmedRevenueMonth).toBe(12800);
    expect(metrics.activeAlerts).toBe(2);
    expect(reminderSummary.pendingCount).toBe(1);
    expect(reminderSummary.overdueCount).toBe(1);
    expect(reminderSummary.pendingAmount).toBe(5400);
    expect(reminderSummary.overdueAmount).toBe(1900);
  });
});
