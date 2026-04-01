/**
 * AI FINANCIAL SIMULATOR — Simulação de cenários financeiros
 *
 * Permite simular impactos de decisões financeiras no futuro.
 */

import { Transaction } from '../../types';
import { runFinancialEngine } from './financialEngine';
import { predictCashflow } from '../finance/cashflowPredictor';

type BalanceAccount = { id: string; balance: number };

export interface FinancialSimulationResult {
  projected_balance: number;
  spending_impact: number;
  simulation_period: number; // em meses
  summary: string;
}

export type SimulationScenario =
  | { type: 'extra_spending'; amount: number; description: string }
  | { type: 'monthly_savings'; amount: number; description: string }
  | { type: 'months'; months: number; description: string };

/**
 * Simula um cenário financeiro.
 */
export function simulateFinancialScenario(
  accounts: BalanceAccount[],
  transactions: Transaction[],
  scenario: SimulationScenario
): FinancialSimulationResult {
  const baseState = runFinancialEngine(transactions);
  const baseBalance = baseState.summary_all_time.balance;

  let projectedBalance = baseBalance;
  let spendingImpact = 0;
  let simulationPeriod = 1;
  let summary = '';

  switch (scenario.type) {
    case 'extra_spending':
      // Simular gasto extra único
      projectedBalance -= scenario.amount;
      spendingImpact = scenario.amount;
      summary = `Gasto extra de R$ ${scenario.amount.toFixed(2)} em ${scenario.description} reduziria seu saldo para R$ ${projectedBalance.toFixed(2)}.`;
      break;

    case 'monthly_savings':
      // Simular economia mensal
      const monthlySavings = scenario.amount;
      projectedBalance += monthlySavings * 12; // projeção anual
      spendingImpact = -monthlySavings * 12; // impacto positivo
      simulationPeriod = 12;
      summary = `Economizar R$ ${monthlySavings.toFixed(2)} por mês em ${scenario.description} aumentaria seu saldo em R$ ${(monthlySavings * 12).toFixed(2)} em um ano.`;
      break;

    case 'months':
      // Projeção por meses usando cashflow predictor
      const mappedAccounts = accounts.map(acc => ({
        id: acc.id,
        user_id: 'simulation',
        name: 'Conta',
        type: 'cash' as const,
        balance: acc.balance,
        currency: 'BRL',
        created_at: new Date().toISOString(),
      }));

      const prediction = predictCashflow(mappedAccounts, transactions);
      const targetDays = Math.max(1, Math.min(90, scenario.months * 30));
      projectedBalance = prediction.daily_balances[targetDays - 1]?.balance ?? prediction.balance_90_days;
      spendingImpact = baseBalance - projectedBalance;
      simulationPeriod = scenario.months;
      summary = `Em ${scenario.months} meses, seu saldo projetado seria R$ ${projectedBalance.toFixed(2)} baseado em ${scenario.description}.`;
      break;
  }

  return {
    projected_balance: projectedBalance,
    spending_impact: spendingImpact,
    simulation_period: simulationPeriod,
    summary,
  };
}
