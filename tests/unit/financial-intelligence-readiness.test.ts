import { describe, expect, it } from 'vitest';

import { buildAdvancedAIContext } from '../../src/engines/ai/contextBuilder/advancedContextBuilder';
import { classifyFinancialProfile } from '../../src/engines/ai/financialProfileClassifier';
import { buildFinancialTimeline } from '../../src/engines/finance/financialTimeline';
import { financialPatternDetector } from '../../src/engines/finance/patternDetector/financialPatternDetector';
import { cashflowPredictionEngine } from '../../src/engines/finance/cashflowPrediction/cashflowPredictionEngine';
import { moneyMapEngine } from '../../src/engines/finance/moneyMap/moneyMapEngine';
import { getLastInsights, runAIOrchestrator } from '../../src/engines/ai/aiOrchestrator';
import { Category, TransactionType, type Transaction } from '../../types';

function transaction(input: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'type' | 'category' | 'description' | 'date'>): Transaction {
  return {
    ...input,
  };
}

function sampleTransactions(): Transaction[] {
  return [
    transaction({
      id: 'income_1',
      amount: 8500,
      type: TransactionType.RECEITA,
      category: Category.CONSULTORIO,
      description: 'Receita clínica',
      date: '2026-01-05T10:00:00.000Z',
    }),
    transaction({
      id: 'income_2',
      amount: 8400,
      type: TransactionType.RECEITA,
      category: Category.CONSULTORIO,
      description: 'Receita clínica',
      date: '2026-02-05T10:00:00.000Z',
    }),
    transaction({
      id: 'income_3',
      amount: 8600,
      type: TransactionType.RECEITA,
      category: Category.CONSULTORIO,
      description: 'Receita clínica',
      date: '2026-03-05T10:00:00.000Z',
    }),
    transaction({
      id: 'netflix_1',
      amount: 59.9,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      description: 'Netflix',
      merchant: 'Netflix',
      date: '2026-01-08T10:00:00.000Z',
    }),
    transaction({
      id: 'netflix_2',
      amount: 59.9,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      description: 'Netflix',
      merchant: 'Netflix',
      date: '2026-02-08T10:00:00.000Z',
    }),
    transaction({
      id: 'netflix_3',
      amount: 59.9,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      description: 'Netflix',
      merchant: 'Netflix',
      date: '2026-03-08T10:00:00.000Z',
    }),
    transaction({
      id: 'weekend_spike_1',
      amount: 900,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      description: 'Viagem final de semana',
      date: '2026-03-14T15:00:00.000Z',
    }),
    transaction({
      id: 'invest_1',
      amount: 1200,
      type: TransactionType.DESPESA,
      category: Category.INVESTIMENTO,
      description: 'Aporte mensal',
      date: '2026-03-15T11:00:00.000Z',
    }),
    transaction({
      id: 'personal_1',
      amount: 700,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      description: 'Mercado',
      date: '2026-03-16T11:00:00.000Z',
    }),
  ];
}

describe('financial intelligence readiness', () => {
  it('consolida os 6 pilares com dados coerentes no contexto avançado', () => {
    const transactions = sampleTransactions();
    const userContext = {
      userId: 'u_readiness',
      accounts: ['acc_main'],
      timezone: 'UTC',
      currency: 'BRL',
    };

    const advanced = buildAdvancedAIContext(userContext, transactions);

    // Pilar 1: context builder avançado
    expect(advanced.base.userId).toBe('u_readiness');
    expect(advanced.base.monthlyIncome).toBeGreaterThan(0);

    // Pilar 2: pattern detector
    expect(advanced.patterns.recurring.length).toBeGreaterThan(0);

    // Pilar 3: financial timeline
    expect(advanced.base.timeline.points.length).toBeGreaterThan(0);
    expect(advanced.base.timeline.totals.finalBalance).toBeGreaterThan(0);

    // Pilar 4: perfil financeiro
    expect(['Saver', 'Spender', 'Balanced', 'Risk Taker']).toContain(advanced.base.financialProfile.profile);

    // Pilar 5: cashflow prediction
    expect(Number.isFinite(advanced.cashflowForecast.in7Days)).toBe(true);
    expect(Number.isFinite(advanced.cashflowForecast.in30Days)).toBe(true);
    expect(Number.isFinite(advanced.cashflowForecast.in90Days)).toBe(true);

    // Pilar 6: money map
    expect(advanced.moneyMap.length).toBeGreaterThan(0);
    expect(advanced.moneyMap[0].percentage).toBeGreaterThan(0);
  });

  it('mantem consistencia entre engines base e orquestrador de IA', async () => {
    const transactions = sampleTransactions();

    const timeline = buildFinancialTimeline(transactions);
    const patterns = financialPatternDetector.detectPatterns(transactions);
    const moneyMap = moneyMapEngine.generate(transactions);
    const profile = classifyFinancialProfile(transactions);

    const incomes = transactions
      .filter((tx) => tx.type === TransactionType.RECEITA)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = transactions
      .filter((tx) => tx.type === TransactionType.DESPESA)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const forecast = cashflowPredictionEngine.predict({
      balance: incomes - expenses,
      transactions,
      patterns,
    });

    const orchestrated = await runAIOrchestrator({
      userContext: {
        userId: 'u_orchestrator_readiness',
        accounts: ['acc_main'],
        timezone: 'UTC',
        currency: 'BRL',
      },
      transactions,
    });

    expect(timeline.totals.finalBalance).toBeCloseTo(incomes - expenses, 2);
    expect(patterns.recurring.length).toBeGreaterThan(0);
    expect(moneyMap[0].percentage).toBeGreaterThan(0);
    expect(['Saver', 'Spender', 'Balanced', 'Risk Taker']).toContain(profile.profile);
    expect(Number.isFinite(forecast.in30Days)).toBe(true);

    const memory = orchestrated.context.memory as {
      moneyMap?: Array<{ percentage: number }>;
      cashflowForecast?: { in30Days: number };
    };

    expect(orchestrated.context.timeline.totals.finalBalance).toBeCloseTo(timeline.totals.finalBalance, 2);
    expect((memory.moneyMap || [])[0].percentage).toBeCloseTo(moneyMap[0].percentage, 2);

    const last = getLastInsights()[0];
    expect(last).toBeDefined();
    expect(last.userId).toBe('u_orchestrator_readiness');
    expect(last.cashflowForecast.in30Days).toBe(memory.cashflowForecast?.in30Days);
  });
});
