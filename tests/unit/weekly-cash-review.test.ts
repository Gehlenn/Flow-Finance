import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Category, TransactionType, type Receivable, type Transaction } from '../../types';
import {
  generateWeeklyCashReport,
  loadWeeklyCashReviewHistory,
  measureWeeklyCashReviewRetention,
  recordWeeklyCashReview,
} from '../../src/finance/weeklyCashReview';

const weeklyReviewMocks = vi.hoisted(() => ({
  trackProductEventOnce: vi.fn(() => true),
}));

vi.mock('../../src/app/productAnalytics', () => ({
  trackProductEventOnce: (...args: unknown[]) => weeklyReviewMocks.trackProductEventOnce(...args),
}));

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'tx',
    amount: overrides.amount ?? 0,
    type: overrides.type ?? TransactionType.RECEITA,
    category: overrides.category ?? Category.NEGOCIO,
    description: overrides.description ?? 'Movimento',
    date: overrides.date ?? '2026-06-03T12:00:00.000Z',
  };
}

function receivable(overrides: Partial<Receivable>): Receivable {
  return {
    id: overrides.id ?? 'rec',
    description: overrides.description ?? 'Recebivel',
    expected_amount: overrides.expected_amount ?? 0,
    realized_amount: overrides.realized_amount ?? 0,
    due_date: overrides.due_date ?? '2026-06-04T12:00:00.000Z',
    realized_at: overrides.realized_at ?? null,
    status: overrides.status ?? 'open',
    source: overrides.source ?? 'manual',
    created_at: overrides.created_at ?? '2026-06-01T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-06-01T00:00:00.000Z',
  };
}

describe('weeklyCashReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('gera relatorio semanal com caixa confirmado, recebiveis e riscos', () => {
    const report = generateWeeklyCashReport({
      referenceDate: '2026-06-04T10:00:00.000Z',
      transactions: [
        tx({ id: 'income-1', amount: 1200, type: TransactionType.RECEITA, date: '2026-06-02T10:00:00.000Z' }),
        tx({ id: 'expense-1', amount: 900, type: TransactionType.DESPESA, date: '2026-06-03T10:00:00.000Z' }),
        tx({ id: 'outside', amount: 999, type: TransactionType.RECEITA, date: '2026-06-10T10:00:00.000Z' }),
      ],
      receivables: [
        receivable({ id: 'open-week', expected_amount: 500, realized_amount: 100, due_date: '2026-06-05T10:00:00.000Z', status: 'open' }),
        receivable({ id: 'overdue', expected_amount: 300, due_date: '2026-05-30T10:00:00.000Z', status: 'overdue' }),
        receivable({ id: 'realized', expected_amount: 250, realized_amount: 250, due_date: '2026-06-02T10:00:00.000Z', realized_at: '2026-06-02T14:00:00.000Z', status: 'realized' }),
      ],
    });

    expect(report.weekStart).toBe('2026-06-01');
    expect(report.weekEnd).toBe('2026-06-07');
    expect(report.confirmedIncome).toBe(1200);
    expect(report.confirmedExpenses).toBe(900);
    expect(report.netConfirmedCash).toBe(300);
    expect(report.projectedReceivables).toBe(400);
    expect(report.overdueReceivables).toBe(300);
    expect(report.realizedReceivables).toBe(250);
    expect(report.projectedWeekCash).toBe(700);
    expect(report.risks).toContain('Ha recebiveis vencidos afetando a leitura de caixa.');
    expect(report.nextActions).toContain('Cobrar recebiveis vencidos antes de assumir novas saidas.');
    expect(report.outcome).toBe('tight');
  });

  it('registra historico semanal por workspace e mede ritual concluido', () => {
    const report = generateWeeklyCashReport({
      referenceDate: '2026-06-04T10:00:00.000Z',
      transactions: [
        tx({ id: 'income-1', amount: 1000, type: TransactionType.RECEITA }),
        tx({ id: 'expense-1', amount: 200, type: TransactionType.DESPESA }),
      ],
      receivables: [],
    });

    const first = recordWeeklyCashReview(report, { workspaceId: 'workspace-1', reviewerId: 'owner-1' });
    const second = recordWeeklyCashReview({ ...report, confirmedIncome: 1100 }, { workspaceId: 'workspace-1' });
    const otherWorkspaceReport = generateWeeklyCashReport({
      referenceDate: '2026-06-11T10:00:00.000Z',
      transactions: [tx({ id: 'other-income', amount: 50, type: TransactionType.RECEITA, date: '2026-06-11T10:00:00.000Z' })],
    });
    recordWeeklyCashReview(otherWorkspaceReport, { workspaceId: 'workspace-2' });

    const history = loadWeeklyCashReviewHistory('workspace-1');
    const otherHistory = loadWeeklyCashReviewHistory('workspace-2');

    expect(first.weekStart).toBe('2026-06-01');
    expect(second.weekStart).toBe('2026-06-01');
    expect(history).toHaveLength(1);
    expect(history[0].confirmedIncome).toBe(1100);
    expect(otherHistory).toHaveLength(1);
    expect(weeklyReviewMocks.trackProductEventOnce).toHaveBeenCalledWith(
      'weekly_cash_review_completed',
      'workspace-1:2026-06-01',
      expect.objectContaining({
        source: 'weekly_cash_review',
        week_start: '2026-06-01',
        outcome: 'positive',
      }),
    );
  });

  it('mede retencao do ritual semanal sem inventar taxa real de produto', () => {
    const weeklyHistory = [
      recordWeeklyCashReview(generateWeeklyCashReport({
        referenceDate: '2026-06-18T10:00:00.000Z',
        transactions: [tx({ id: 'week-3', amount: 100, date: '2026-06-18T10:00:00.000Z' })],
      }), { workspaceId: 'workspace-retention' }),
      recordWeeklyCashReview(generateWeeklyCashReport({
        referenceDate: '2026-06-11T10:00:00.000Z',
        transactions: [tx({ id: 'week-2', amount: 100, date: '2026-06-11T10:00:00.000Z' })],
      }), { workspaceId: 'workspace-retention' }),
    ];

    const retention = measureWeeklyCashReviewRetention(weeklyHistory, {
      referenceDate: '2026-06-18T10:00:00.000Z',
      lookbackWeeks: 4,
    });

    expect(retention.expectedWeeks).toBe(4);
    expect(retention.completedWeeks).toBe(2);
    expect(retention.completionRate).toBe(0.5);
    expect(retention.currentStreakWeeks).toBe(2);
    expect(retention.evidence).toBe('local_review_history');
  });
});
