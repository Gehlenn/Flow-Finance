import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictCashflow, formatPredictionLabel, predictionTrend } from '../../src/finance/cashflowPredictor';
import { Category, TransactionType } from '../../types';
import type { Transaction } from '../../types';
import type { Account } from '../../models/Account';

// ─── Mock: FinancialEventEmitter (no side-effects) ────────────────────────────
vi.mock('../../src/events/eventEngine', () => ({
  FinancialEventEmitter: {
    insightGenerated: vi.fn(),
    bankTransactionsSynced: vi.fn(),
  },
}));

// ─── Fixture helpers ──────────────────────────────────────────────────────────

let _id = 0;

function makeTx(
  description: string,
  amount: number,
  type: TransactionType,
  daysAgo: number,
  recurring = false,
  recurrence_type: 'monthly' | 'weekly' | 'daily' = 'monthly',
): Transaction {
  return {
    id: `t${++_id}`,
    description,
    amount,
    type,
    category: Category.PESSOAL,
    date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    recurring,
    recurrence_type,
    recurrence_interval: 1,
    confidence_score: 0.8,
  } as any;
}

function makeAccount(id: string, balance: number): Account {
  return { id, userId: 'u1', name: 'Conta', type: 'checking', balance, currency: 'BRL', isActive: true, createdAt: new Date(), updatedAt: new Date() } as any;
}

// ─── predictCashflow ──────────────────────────────────────────────────────────

describe('predictCashflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses account balance when accounts are provided', () => {
    const accounts = [makeAccount('a1', 3000), makeAccount('a2', 1500)];
    const result = predictCashflow(accounts, []);
    expect(result.current_balance).toBe(4500);
  });

  it('derives balance from transactions when no accounts provided', () => {
    const txs = [
      makeTx('Salário',    5000, TransactionType.RECEITA, 10),
      makeTx('Aluguel',    1200, TransactionType.DESPESA, 5),
    ];
    const result = predictCashflow([], txs);
    expect(result.current_balance).toBe(3800);
  });

  it('returns 90 daily_balances entries', () => {
    const result = predictCashflow([makeAccount('a1', 1000)], []);
    expect(result.daily_balances).toHaveLength(90);
  });

  it('projected_transactions includes future occurrences of recurring expenses', () => {
    const txs = [
      // 3 months of salary (so the recurring detector picks it up)
      makeTx('Netflix', 50, TransactionType.DESPESA, 5,  true),
      makeTx('Netflix', 50, TransactionType.DESPESA, 35, true),
      makeTx('Netflix', 50, TransactionType.DESPESA, 65, true),
    ];
    const result = predictCashflow([makeAccount('a1', 2000)], txs);
    // There should be at least 1 projected transaction (next month Netflix)
    expect(result.projected_transactions.length).toBeGreaterThanOrEqual(1);
  });

  it('lowest_point balance is ≤ highest_point balance', () => {
    const txs = [
      makeTx('Salário',    5000, TransactionType.RECEITA, 5),
      makeTx('Aluguel',    1500, TransactionType.DESPESA, 5),
    ];
    const result = predictCashflow([makeAccount('a1', 5000)], txs);
    expect(result.lowest_point.balance).toBeLessThanOrEqual(result.highest_point.balance);
  });

  it('balance_7_days is consistent with daily_balances[6]', () => {
    const result = predictCashflow([makeAccount('a1', 1000)], []);
    expect(result.balance_7_days).toBe(result.daily_balances[6].balance);
  });

  it('balance_30_days is consistent with daily_balances[29]', () => {
    const result = predictCashflow([makeAccount('a1', 1000)], []);
    expect(result.balance_30_days).toBe(result.daily_balances[29].balance);
  });

  it('balance_90_days is consistent with daily_balances[89]', () => {
    const result = predictCashflow([makeAccount('a1', 1000)], []);
    expect(result.balance_90_days).toBe(result.daily_balances[89].balance);
  });

  it('emits insightGenerated event', async () => {
    const { FinancialEventEmitter } = await import('../../src/events/eventEngine');
    predictCashflow([makeAccount('a1', 1000)], []);
    expect(FinancialEventEmitter.insightGenerated).toHaveBeenCalledOnce();
  });

  it('projected_income and projected_expenses are non-negative', () => {
    const txs = [
      makeTx('Salário', 5000, TransactionType.RECEITA, 5),
      makeTx('Aluguel', 1200, TransactionType.DESPESA, 5),
    ];
    const result = predictCashflow([], txs);
    expect(result.projected_income).toBeGreaterThanOrEqual(0);
    expect(result.projected_expenses).toBeGreaterThanOrEqual(0);
  });

  it('agrupa multiplas recorrencias no mesmo dia sem perder transacoes', () => {
    const txs = [
      makeTx('Academia', 100, TransactionType.DESPESA, 5, true),
      makeTx('Academia', 100, TransactionType.DESPESA, 35, true),
      makeTx('Academia', 100, TransactionType.DESPESA, 65, true),
      makeTx('Streaming', 40, TransactionType.DESPESA, 5, true),
      makeTx('Streaming', 40, TransactionType.DESPESA, 35, true),
      makeTx('Streaming', 40, TransactionType.DESPESA, 65, true),
    ];

    const result = predictCashflow([makeAccount('a1', 2000)], txs);
    expect(result.projected_transactions.length).toBeGreaterThanOrEqual(2);
  });

  it('aplica recorrencias de receita aumentando o saldo projetado', () => {
    const txs = [
      makeTx('Salário recorrente', 3000, TransactionType.RECEITA, 5, true),
      makeTx('Salário recorrente', 3000, TransactionType.RECEITA, 35, true),
      makeTx('Salário recorrente', 3000, TransactionType.RECEITA, 65, true),
    ];

    const result = predictCashflow([makeAccount('a1', 1000)], txs);
    expect(result.balance_30_days).toBeGreaterThanOrEqual(1000);
  });

  it('ignora transacoes geradas ao calcular baseline historico', () => {
    const txs = [
      { ...makeTx('Salário', 5000, TransactionType.RECEITA, 5), generated: true },
      { ...makeTx('Aluguel', 1200, TransactionType.DESPESA, 5), generated: true },
    ] as Transaction[];

    const result = predictCashflow([], txs);
    expect(result.projected_income).toBe(0);
    expect(result.projected_expenses).toBe(0);
  });
});

// ─── formatPredictionLabel ────────────────────────────────────────────────────

describe('formatPredictionLabel', () => {
  it('returns "Em 7 dias" for 7', ()  => expect(formatPredictionLabel(7)).toBe('Em 7 dias'));
  it('returns "Em 30 dias" for 30', () => expect(formatPredictionLabel(30)).toBe('Em 30 dias'));
  it('returns "Em 90 dias" for 90', () => expect(formatPredictionLabel(90)).toBe('Em 90 dias'));
  it('returns generic label for other values', () => expect(formatPredictionLabel(14)).toBe('Em 14 dias'));
});

// ─── predictionTrend ──────────────────────────────────────────────────────────

describe('predictionTrend', () => {
  it('"up" when future > current by more than 2%', () => {
    expect(predictionTrend(1000, 1050)).toBe('up');
  });

  it('"down" when future < current by more than 2%', () => {
    expect(predictionTrend(1000, 950)).toBe('down');
  });

  it('"stable" when change is within ±2%', () => {
    expect(predictionTrend(1000, 1010)).toBe('stable');
    expect(predictionTrend(1000, 995)).toBe('stable');
  });

  it('"stable" when current is 0 (no division by zero)', () => {
    expect(predictionTrend(0, 100)).toBe('stable');
  });
});
