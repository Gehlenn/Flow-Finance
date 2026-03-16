import { describe, expect, it } from 'vitest';
import {
  buildFinancialTimeline,
  aggregateByMonth,
  detectBalanceTrend,
  detectTimelineAnomalies,
  type FinancialTimeline,
} from '../../src/engines/finance/financialTimeline';
import { Category, TransactionType, type Transaction } from '../../types';

function makeTx(id: string, amount: number, type: TransactionType, date: string): Transaction {
  return { id, amount, type, category: Category.PESSOAL, description: id, date };
}

describe('buildFinancialTimeline', () => {
  it('builds timeline and running balance evolution', () => {
    const transactions: Transaction[] = [
      {
        id: '1', amount: 1000, type: TransactionType.RECEITA, category: Category.CONSULTORIO,
        description: 'Income', date: '2026-03-01T10:00:00.000Z',
      },
      {
        id: '2', amount: 200, type: TransactionType.DESPESA, category: Category.PESSOAL,
        description: 'Expense', date: '2026-03-02T10:00:00.000Z',
      },
      {
        id: '3', amount: 150, type: TransactionType.DESPESA, category: Category.PESSOAL,
        description: 'Expense2', date: '2026-03-02T20:00:00.000Z',
      },
    ];

    const timeline = buildFinancialTimeline(transactions);

    expect(timeline.points.length).toBe(2);
    expect(timeline.totals.income).toBe(1000);
    expect(timeline.totals.expenses).toBe(350);
    expect(timeline.totals.finalBalance).toBe(650);
  });

  it('retorna timeline vazia para lista sem transacoes', () => {
    const timeline = buildFinancialTimeline([]);
    expect(timeline.points).toHaveLength(0);
    expect(timeline.totals.income).toBe(0);
    expect(timeline.totals.finalBalance).toBe(0);
  });

  it('acumula saldo corretamente em dias distintos', () => {
    const transactions: Transaction[] = [
      makeTx('r1', 500, TransactionType.RECEITA, '2026-01-01T00:00:00.000Z'),
      makeTx('d1', 100, TransactionType.DESPESA, '2026-01-02T00:00:00.000Z'),
      makeTx('r2', 200, TransactionType.RECEITA, '2026-01-03T00:00:00.000Z'),
    ];
    const timeline = buildFinancialTimeline(transactions);
    expect(timeline.points[0].balance).toBe(500);
    expect(timeline.points[1].balance).toBe(400);
    expect(timeline.points[2].balance).toBe(600);
  });
});

describe('aggregateByMonth', () => {
  it('agrega receitas e despesas por mes', () => {
    const transactions: Transaction[] = [
      makeTx('r1', 3000, TransactionType.RECEITA, '2026-01-05T00:00:00.000Z'),
      makeTx('d1', 1000, TransactionType.DESPESA, '2026-01-10T00:00:00.000Z'),
      makeTx('r2', 4000, TransactionType.RECEITA, '2026-02-03T00:00:00.000Z'),
      makeTx('d2', 2500, TransactionType.DESPESA, '2026-02-20T00:00:00.000Z'),
    ];
    const months = aggregateByMonth(transactions);
    expect(months).toHaveLength(2);
    expect(months[0].month).toBe('2026-01');
    expect(months[0].income).toBe(3000);
    expect(months[0].expenses).toBe(1000);
    expect(months[0].balance).toBe(2000);
    expect(months[0].savingsRate).toBeCloseTo(2000 / 3000, 3);
    expect(months[1].month).toBe('2026-02');
    expect(months[1].balance).toBe(1500);
  });

  it('retorna array vazio para lista sem transacoes', () => {
    expect(aggregateByMonth([])).toHaveLength(0);
  });

  it('ignora transacoes com data invalida', () => {
    const transactions: Transaction[] = [
      makeTx('x1', 100, TransactionType.RECEITA, 'invalid-date'),
      makeTx('x2', 200, TransactionType.RECEITA, '2026-03-01T00:00:00.000Z'),
    ];
    const months = aggregateByMonth(transactions);
    expect(months).toHaveLength(1);
    expect(months[0].income).toBe(200);
  });

  it('savingsRate e zero quando income e zero', () => {
    const months = aggregateByMonth([
      makeTx('d1', 500, TransactionType.DESPESA, '2026-04-01T00:00:00.000Z'),
    ]);
    expect(months[0].savingsRate).toBe(0);
  });
});

describe('detectBalanceTrend', () => {
  const makeTimeline = (balances: number[]): FinancialTimeline => ({
    points: balances.map((b, i) => ({ date: `2026-0${i + 1}-01`, income: b > 0 ? b : 0, expenses: b < 0 ? Math.abs(b) : 0, balance: b })),
    totals: { income: 0, expenses: 0, finalBalance: balances[balances.length - 1] ?? 0 },
  });

  it('detecta tendencia crescente', () => {
    const trend = detectBalanceTrend(makeTimeline([100, 300, 600, 900, 1400]));
    expect(trend).toBe('growing');
  });

  it('detecta tendencia decrescente', () => {
    const trend = detectBalanceTrend(makeTimeline([1400, 900, 600, 300, 100]));
    expect(trend).toBe('declining');
  });

  it('detecta tendencia estavel', () => {
    const trend = detectBalanceTrend(makeTimeline([500, 502, 498, 501, 499]));
    expect(trend).toBe('stable');
  });

  it('retorna stable para timeline com um unico ponto', () => {
    const trend = detectBalanceTrend(makeTimeline([1000]));
    expect(trend).toBe('stable');
  });
});

describe('detectTimelineAnomalies', () => {
  it('detecta pico de despesa acima de 2x mediana', () => {
    const timeline = buildFinancialTimeline([
      makeTx('d1', 100, TransactionType.DESPESA, '2026-01-01T00:00:00.000Z'),
      makeTx('d2', 100, TransactionType.DESPESA, '2026-01-02T00:00:00.000Z'),
      makeTx('d3', 500, TransactionType.DESPESA, '2026-01-03T00:00:00.000Z'), // pico
    ]);
    const anomalies = detectTimelineAnomalies(timeline);
    const spike = anomalies.find((a) => a.type === 'expense_spike');
    expect(spike).toBeDefined();
    expect(spike!.ratioToMedian).toBeGreaterThan(2);
  });

  it('detecta pico de receita', () => {
    const timeline = buildFinancialTimeline([
      makeTx('r1', 200, TransactionType.RECEITA, '2026-01-01T00:00:00.000Z'),
      makeTx('r2', 200, TransactionType.RECEITA, '2026-01-02T00:00:00.000Z'),
      makeTx('r3', 1000, TransactionType.RECEITA, '2026-01-03T00:00:00.000Z'), // pico
    ]);
    const anomalies = detectTimelineAnomalies(timeline);
    const spike = anomalies.find((a) => a.type === 'income_spike');
    expect(spike).toBeDefined();
  });

  it('detecta dia sem receita com despesas', () => {
    const timeline = buildFinancialTimeline([
      makeTx('d1', 300, TransactionType.DESPESA, '2026-02-05T00:00:00.000Z'),
    ]);
    const anomalies = detectTimelineAnomalies(timeline);
    expect(anomalies.some((a) => a.type === 'no_income')).toBe(true);
  });

  it('retorna array vazio para timeline sem pontos', () => {
    const empty: FinancialTimeline = { points: [], totals: { income: 0, expenses: 0, finalBalance: 0 } };
    expect(detectTimelineAnomalies(empty)).toHaveLength(0);
  });

  it('nao gera anomalia quando despesas sao uniformes', () => {
    const timeline = buildFinancialTimeline([
      makeTx('r1', 500, TransactionType.RECEITA, '2026-01-01T00:00:00.000Z'),
      makeTx('d1', 100, TransactionType.DESPESA, '2026-01-02T00:00:00.000Z'),
      makeTx('d2', 100, TransactionType.DESPESA, '2026-01-03T00:00:00.000Z'),
    ]);
    const anomalies = detectTimelineAnomalies(timeline);
    expect(anomalies.filter((a) => a.type === 'expense_spike')).toHaveLength(0);
  });
});
