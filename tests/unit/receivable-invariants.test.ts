import { describe, expect, it } from 'vitest';
import { calculateDashboardMetrics } from '../../components/Dashboard';
import { calculateRevenueStateSummary } from '../../components/CashFlow';
import { buildDashboardReceivableAggregate } from '../../src/finance/receivableService';
import { Category, Receivable, TransactionType, type Transaction } from '../../types';

const referenceDate = new Date('2026-05-15T10:00:00.000Z');

describe('receivable invariants', () => {
  it('keeps dashboard projected revenue aligned with receivable aggregate and cashflow when receivables are source of truth', () => {
    const receivables: Receivable[] = [
      {
        id: 'recv-pending',
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        workspace_id: 'ws-1',
        description: 'Recebivel pendente',
        expected_amount: 120.15,
        realized_amount: 0,
        due_date: '2026-05-18',
        realized_at: null,
        status: 'open',
        source: 'manual',
        created_at: '2026-05-15T00:00:00.000Z',
        updated_at: '2026-05-15T00:00:00.000Z',
      },
      {
        id: 'recv-overdue',
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        workspace_id: 'ws-1',
        description: 'Recebivel vencido',
        expected_amount: 89.35,
        realized_amount: 0,
        due_date: '2026-05-10',
        realized_at: null,
        status: 'open',
        source: 'manual',
        created_at: '2026-05-15T00:00:00.000Z',
        updated_at: '2026-05-15T00:00:00.000Z',
      },
      {
        id: 'recv-realized',
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        workspace_id: 'ws-1',
        description: 'Recebivel realizado',
        expected_amount: 200,
        realized_amount: 200,
        due_date: '2026-05-01',
        realized_at: '2026-05-03T12:00:00.000Z',
        status: 'realized',
        source: 'manual',
        created_at: '2026-05-15T00:00:00.000Z',
        updated_at: '2026-05-15T00:00:00.000Z',
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx-income',
        amount: 200,
        type: TransactionType.RECEITA,
        category: Category.NEGOCIO,
        description: 'Receita confirmada',
        date: '2026-05-03T12:00:00.000Z',
      },
    ];

    const aggregate = buildDashboardReceivableAggregate(receivables, referenceDate);
    const dashboardMetrics = calculateDashboardMetrics(
      transactions,
      [],
      [],
      0,
      referenceDate,
      receivables,
      true,
    );
    const cashFlowSummary = calculateRevenueStateSummary(
      transactions,
      receivables,
      referenceDate,
      true,
    );

    expect(aggregate.pending).toBe(120.15);
    expect(aggregate.overdue).toBe(89.35);
    expect(aggregate.projected).toBe(209.5);
    expect(dashboardMetrics.pendingRevenueMonth).toBe(aggregate.pending);
    expect(dashboardMetrics.overdueRevenueAmount).toBe(aggregate.overdue);
    expect(dashboardMetrics.projectedRevenueMonth).toBe(aggregate.projected);
    expect(cashFlowSummary.pending).toBe(aggregate.pending);
    expect(cashFlowSummary.overdue).toBe(aggregate.overdue);
    expect(cashFlowSummary.projected).toBe(aggregate.projected);
    expect(dashboardMetrics.confirmedRevenueMonth).toBe(200);
  });
});
