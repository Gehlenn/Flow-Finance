import { describe, it, expect } from 'vitest';
import { TransactionType } from '../../types';
import { calculateCashflow, calculateCashflowSummary } from '../../src/engines/finance/cashflowEngine';

describe('cashflowEngine', () => {
  const txs = [
    { amount: 100, type: TransactionType.RECEITA },
    { amount: 50, type: TransactionType.DESPESA },
    { amount: 30, type: TransactionType.DESPESA },
    { amount: 20, type: TransactionType.RECEITA },
  ];

  it('calcula o fluxo de caixa total corretamente', () => {
    const total = calculateCashflow(txs);
    expect(total).toBe(100 + 50 + 30 + 20);
  });

  it('calcula resumo de receitas, despesas e saldo', () => {
    const summary = calculateCashflowSummary(txs);
    expect(summary.income).toBe(120);
    expect(summary.expenses).toBe(80);
    expect(summary.balance).toBe(40);
  });

  it('retorna zero para lista vazia', () => {
    expect(calculateCashflow([])).toBe(0);
    const summary = calculateCashflowSummary([]);
    expect(summary.income).toBe(0);
    expect(summary.expenses).toBe(0);
    expect(summary.balance).toBe(0);
  });

  it('lida com tipos indefinidos', () => {
    const txsInvalid = [
      { amount: 10 },
      { amount: 20, type: undefined },
    ];
    const summary = calculateCashflowSummary(txsInvalid as any);
    expect(summary.income).toBe(0);
    expect(summary.expenses).toBe(30);
    expect(summary.balance).toBe(-30);
  });
});
