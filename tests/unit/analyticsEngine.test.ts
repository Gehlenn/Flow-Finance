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
      description: 'Receita salário',
    },
    {
      id: '2',
      amount: 50,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      date: baseDate.toISOString(),
      description: 'Despesa alimentação',
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
      description: 'Despesa alimentação 2',
    },
  ];

  it('agrupa despesas por categoria corretamente', () => {
    const result = buildExpenseCategoryData(txs);
    expect(result).toEqual([
      { name: Category.PESSOAL, value: 70 },
      { name: Category.NEGOCIO, value: 30 },
    ]);
  });

  it('retorna array vazio se não houver despesas', () => {
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

  it('filtra transações por timeframe 7d', () => {
    const filtered = filterTransactionsByTimeframe(txs, '7d');
    expect(filtered.length).toBe(txs.length);
  });

  it('filtra transações por timeframe custom', () => {
    const oldDate = new Date(baseDate.getTime() - 10 * 86400000).toISOString();
    const txsCustom = [...txs, { ...txs[0], id: '5', date: oldDate, description: 'Receita salário antiga', category: Category.CONSULTORIO }];
    // O filtro custom deve pegar apenas as transações do dia baseDate
    const dateStr = baseDate.toISOString().slice(0, 10);
    const filtered = filterTransactionsByTimeframe(txsCustom, 'custom', dateStr, dateStr);
    // Garante que todas as transações do dia baseDate estão presentes
    const expected = txsCustom.filter(t => t.date.slice(0, 10) === dateStr);
    expect(filtered.length).toBe(expected.length);
  });

  it('retorna vazio para timeframe sem match', () => {
    const oldDate = new Date(baseDate.getTime() - 400 * 86400000).toISOString();
    const txsOld = [{ ...txs[0], id: '6', date: oldDate, description: 'Receita salário muito antiga', category: Category.CONSULTORIO }];
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
      { id: '1', amount: 40, type: TransactionType.DESPESA, category: Category.PESSOAL, date: new Date().toISOString(), description: 'Alerta alimentação 1' },
      { id: '2', amount: 30, type: TransactionType.DESPESA, category: Category.PESSOAL, date: new Date().toISOString(), description: 'Alerta alimentação 2' },
      { id: '3', amount: 20, type: TransactionType.DESPESA, category: Category.NEGOCIO, date: new Date().toISOString(), description: 'Alerta transporte' },
    ];
    const result = calculateAlertProgress(txsAlert, alert);
    expect(result.spent).toBe(70);
    expect(result.percent).toBe(70);
  });

  it('calcula progresso de alerta geral corretamente', () => {
    const alert = { id: '2', category: 'Geral' as const, threshold: 50, timeframe: 'mensal' as const };
    const txsAlert = [
      { id: '1', amount: 20, type: TransactionType.DESPESA, category: Category.PESSOAL, date: new Date().toISOString(), description: 'Alerta alimentação geral' },
      { id: '2', amount: 40, type: TransactionType.DESPESA, category: Category.NEGOCIO, date: new Date().toISOString(), description: 'Alerta transporte geral' },
    ];
    const result = calculateAlertProgress(txsAlert, alert);
    expect(result.spent).toBe(60);
    expect(result.percent).toBe(100);
  });

  it('progresso de alerta com threshold zero não quebra', () => {
    const alert = { id: '3', category: Category.PESSOAL, threshold: 0, timeframe: 'mensal' as const };
    const txsAlert = [
      { id: '1', amount: 10, type: TransactionType.DESPESA, category: Category.PESSOAL, date: new Date().toISOString(), description: 'Alerta alimentação threshold zero' },
    ];
    const result = calculateAlertProgress(txsAlert, alert);
    expect(result.spent).toBe(10);
    expect(result.percent).toBe(100);
  });
});
