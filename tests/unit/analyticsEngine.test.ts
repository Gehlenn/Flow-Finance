import { describe, it, expect } from 'vitest';
import { TransactionType, Category } from '../../types';
import { buildExpenseCategoryData, buildCashflowTimeline, filterTransactionsByTimeframe, calculateSignedBalance, calculateAlertProgress } from '../../src/engines/finance/analyticsEngine';

describe('analyticsEngine', () => {
  const baseDate = new Date();
  const txs = [
    {
      id: '1',
      amount: 100,
      type: TransactionType.RECEITA,
      category: Category.CONSULTORIO,
      date: baseDate.toISOString(),
      description: 'Receita salario',
    },
    {
      id: '2',
      amount: 50,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      date: baseDate.toISOString(),
      description: 'Despesa alimentacao',
    },
    {
      id: '3',
      amount: 30,
      type: TransactionType.DESPESA,
      category: Category.NEGOCIO,
      date: baseDate.toISOString(),
      description: 'Despesa transporte',
    },
    {
      id: '4',
      amount: 20,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      date: baseDate.toISOString(),
      description: 'Despesa alimentacao 2',
    },
  ];

  it('agrupa despesas por categoria corretamente', () => {
    const result = buildExpenseCategoryData(txs);
    expect(result).toEqual([
      { name: Category.PESSOAL, value: 70 },
      { name: Category.NEGOCIO, value: 30 },
    ]);
  });

  it('retorna array vazio se nao houver despesas', () => {
    const receitas = txs.filter(t => t.type === TransactionType.RECEITA);
    expect(buildExpenseCategoryData(receitas)).toEqual([]);
  });

  it('monta timeline de fluxo de caixa corretamente', () => {
    const timeline = buildCashflowTimeline(txs);
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline[0]).toHaveProperty('date');
    expect(timeline[0]).toHaveProperty('incoming');
    expect(timeline[0]).toHaveProperty('outgoing');
  });

  it('trata datas date-only como dias locais na timeline de caixa', () => {
    const timeline = buildCashflowTimeline([
      {
        id: '10',
        amount: 100,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        date: '2026-03-10',
        description: 'Receita salario',
      },
      {
        id: '11',
        amount: 50,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        date: '2026-03-10',
        description: 'Despesa alimentacao',
      },
    ]);

    expect(timeline).toHaveLength(1);
    expect(timeline[0].date).toBe('10/03');
    expect(timeline[0].rawDate).toBe('2026-03-10');
  });

  it('filtra transacoes por timeframe 7d', () => {
    const filtered = filterTransactionsByTimeframe(txs, '7d');
    expect(filtered.length).toBe(txs.length);
  });

  it('filtra transacoes por timeframe custom', () => {
    const oldDate = new Date(baseDate.getTime() - 10 * 86400000).toISOString();
    const txsCustom = [...txs, { ...txs[0], id: '5', date: oldDate, description: 'Receita salario antiga', category: Category.CONSULTORIO }];
    const dateStr = baseDate.toISOString().slice(0, 10);
    const filtered = filterTransactionsByTimeframe(txsCustom, 'custom', dateStr, dateStr);
    const expected = txsCustom.filter(t => t.date.slice(0, 10) === dateStr);
    expect(filtered.length).toBe(expected.length);
  });

  it('filtra datas date-only por timeframe custom sem drift', () => {
    const txsCustom = [
      { ...txs[0], id: '7', date: '2026-03-10', description: 'Receita salario date-only', category: Category.CONSULTORIO },
      { ...txs[1], id: '8', date: '2026-03-11', description: 'Despesa alimentacao date-only', category: Category.PESSOAL },
    ];
    const filtered = filterTransactionsByTimeframe(txsCustom, 'custom', '2026-03-10', '2026-03-10');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('7');
  });

  it('trata date-only com timezone distinto sem deslocar a faixa customizada', () => {
    const filtered = filterTransactionsByTimeframe([
      { ...txs[0], id: '9', date: '2026-03-10', description: 'Receita timezone local', category: Category.CONSULTORIO },
      { ...txs[1], id: '10', date: '2026-03-11', description: 'Despesa timezone local', category: Category.PESSOAL },
    ], 'custom', '2026-03-10', '2026-03-11');

    expect(filtered.map((tx) => tx.id)).toEqual(['9', '10']);
  });

  it('retorna vazio para timeframe sem match', () => {
    const oldDate = new Date(baseDate.getTime() - 400 * 86400000).toISOString();
    const txsOld = [{ ...txs[0], id: '6', date: oldDate, description: 'Receita salario muito antiga', category: Category.CONSULTORIO }];
    const filtered = filterTransactionsByTimeframe(txsOld, '7d');
    expect(filtered.length).toBe(0);
  });

  it('calcula saldo assinado corretamente', () => {
    const txsSigned = [
      { amount: 100, type: TransactionType.RECEITA, description: 'Receita 1' },
      { amount: 50, type: TransactionType.DESPESA, description: 'Despesa 1' },
      { amount: 20, type: TransactionType.RECEITA, description: 'Receita 2' },
      { amount: 10, type: TransactionType.DESPESA, description: 'Despesa 2' },
    ];
    expect(calculateSignedBalance(txsSigned)).toBe(60);
    expect(calculateSignedBalance([])).toBe(0);
  });

  it('calcula progresso de alerta corretamente', () => {
    const alert = { id: '1', category: Category.PESSOAL, threshold: 100, timeframe: 'mensal' as const };
    const txsAlert = [
      { id: '1', amount: 40, type: TransactionType.DESPESA, category: Category.PESSOAL, date: new Date().toISOString(), description: 'Alerta alimentacao 1' },
      { id: '2', amount: 30, type: TransactionType.DESPESA, category: Category.PESSOAL, date: new Date().toISOString(), description: 'Alerta alimentacao 2' },
      { id: '3', amount: 20, type: TransactionType.DESPESA, category: Category.NEGOCIO, date: new Date().toISOString(), description: 'Alerta transporte' },
    ];
    const result = calculateAlertProgress(txsAlert, alert);
    expect(result.spent).toBe(70);
    expect(result.percent).toBe(70);
  });

  it('calcula progresso de alerta geral corretamente', () => {
    const alert = { id: '2', category: 'Geral' as const, threshold: 50, timeframe: 'mensal' as const };
    const txsAlert = [
      { id: '1', amount: 20, type: TransactionType.DESPESA, category: Category.PESSOAL, date: new Date().toISOString(), description: 'Alerta alimentacao geral' },
      { id: '2', amount: 40, type: TransactionType.DESPESA, category: Category.NEGOCIO, date: new Date().toISOString(), description: 'Alerta transporte geral' },
    ];
    const result = calculateAlertProgress(txsAlert, alert);
    expect(result.spent).toBe(60);
    expect(result.percent).toBe(100);
  });

  it('progresso de alerta com threshold zero nao quebra', () => {
    const alert = { id: '3', category: Category.PESSOAL, threshold: 0, timeframe: 'mensal' as const };
    const txsAlert = [
      { id: '1', amount: 10, type: TransactionType.DESPESA, category: Category.PESSOAL, date: new Date().toISOString(), description: 'Alerta alimentacao threshold zero' },
    ];
    const result = calculateAlertProgress(txsAlert, alert);
    expect(result.spent).toBe(10);
    expect(result.percent).toBe(100);
  });
});
