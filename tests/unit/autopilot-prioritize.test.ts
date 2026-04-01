import { describe, expect, it } from 'vitest';

import { prioritizeActions } from '../../src/engines/autopilot/financialAutopilot';
import { Category, TransactionType, type Transaction } from '../../types';

function makeTx(partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'type' | 'category'>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    description: 'test',
    date: '2026-01-15T10:00:00.000Z',
    ...partial,
  };
}

describe('prioritizeActions', () => {
  it('saldo negativo gera ação critica com priorityScore 100', () => {
    const result = prioritizeActions(5000, 3000, -500);
    const action = result.actions.find((a) => a.id === 'negative_balance');
    expect(action).toBeDefined();
    expect(action!.priority).toBe('critica');
    expect(action!.priorityScore).toBe(100);
    expect(action!.riskScore).toBe(100);
    expect(action!.suggestedCut).toBe(500);
  });

  it('topAction é a ação com maior priorityScore', () => {
    // saldo negativo E overspending → negative_balance (100) deve ser topo
    const result = prioritizeActions(3000, 5000, -500);
    expect(result.topAction).not.toBeNull();
    expect(result.topAction!.priorityScore).toBe(
      Math.max(...result.actions.map((a) => a.priorityScore)),
    );
  });

  it('overspending gera ação critica com suggestedCut correto', () => {
    const result = prioritizeActions(5000, 7000, 1000);
    const action = result.actions.find((a) => a.id === 'overspending');
    expect(action).toBeDefined();
    expect(action!.priority).toBe('critica');
    expect(action!.suggestedCut).toBe(2000);
  });

  it('savings < 10% gera ação alta com id low_savings', () => {
    // savings = (5000 - 4600)/5000 = 8%
    const result = prioritizeActions(5000, 4600, 500);
    const action = result.actions.find((a) => a.id === 'low_savings');
    expect(action).toBeDefined();
    expect(action!.priority).toBe('alta');
    expect(action!.priorityScore).toBe(75);
  });

  it('categorias dominantes (>35%) geram ação com categoria correta', () => {
    const txs: Transaction[] = [
      makeTx({ amount: 4000, type: TransactionType.DESPESA, category: Category.PESSOAL }),
      makeTx({ amount: 500, type: TransactionType.DESPESA, category: Category.NEGOCIO }),
    ];
    // PESSOAL = 4000/4500 = 88.9% → dominante
    const result = prioritizeActions(10000, 4500, 1000, txs);
    const action = result.actions.find((a) => a.id === 'dominant_category');
    expect(action).toBeDefined();
    expect(action!.category).toBeDefined();
  });

  it('ações ordenadas por priorityScore decrescente', () => {
    const txs: Transaction[] = [
      makeTx({ amount: 5000, type: TransactionType.DESPESA, category: Category.PESSOAL }),
    ];
    const result = prioritizeActions(3000, 7000, -1000, txs);
    const scores = result.actions.map((a) => a.priorityScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('situação estável retorna ação de manutenção', () => {
    // boa poupança, saldo positivo, sem overspending, sem transações
    const result = prioritizeActions(10000, 7000, 5000, [], 'Balanced');
    expect(result.actions.some((a) => a.id === 'maintain_health')).toBe(true);
  });

  it('retorna pelo menos uma ação sempre', () => {
    const result = prioritizeActions(0, 0, 0);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.topAction).not.toBeNull();
  });

  it('Saver com 20%+ poupança recebe ação invest_surplus', () => {
    const result = prioritizeActions(10000, 7000, 5000, [], 'Saver');
    const action = result.actions.find((a) => a.id === 'invest_surplus');
    expect(action).toBeDefined();
    expect(action!.priority).toBe('baixa');
  });

  it('categorias com <35% não geram ação dominant_category', () => {
    const txs: Transaction[] = [
      makeTx({ amount: 1000, type: TransactionType.DESPESA, category: Category.PESSOAL }),
      makeTx({ amount: 1000, type: TransactionType.DESPESA, category: Category.NEGOCIO }),
      makeTx({ amount: 1000, type: TransactionType.DESPESA, category: Category.INVESTIMENTO }),
    ];
    // nenhuma categoria > 35%
    const result = prioritizeActions(10000, 3000, 5000, txs, 'Balanced');
    const action = result.actions.find((a) => a.id === 'dominant_category');
    expect(action).toBeUndefined();
  });
});
