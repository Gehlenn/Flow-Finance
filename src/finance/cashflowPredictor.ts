/**
 * CASHFLOW PREDICTOR
 *
 * Simula o fluxo de caixa dia a dia pelos próximos 90 dias,
 * expandindo transações recorrentes e usando média histórica
 * para projetar fluxos sem recorrência definida.
 */

import { Transaction, TransactionType } from '../../types';
import { Account } from '../../models/Account';
import { generateRecurringTransactions } from './recurringService';
import { FinancialEventEmitter } from '../events/eventEngine';

// ─── Extended model (superset do CashflowPrediction do riskAnalyzer) ──────────

export interface ExtendedCashflowPrediction {
  current_balance: number;
  balance_7_days: number;
  balance_30_days: number;
  balance_90_days: number;           // NOVO
  projected_income: number;          // projeção mensal
  projected_expenses: number;        // projeção mensal
  projected_transactions: Transaction[];  // transações simuladas
  daily_balances: { date: string; balance: number }[];  // curva dia a dia
  lowest_point: { date: string; balance: number };      // pior momento
  highest_point: { date: string; balance: number };     // melhor momento
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function calcMonthlyAvg(txs: Transaction[], type: TransactionType, months = 3): number {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const recent = txs.filter(t => !t.generated && t.type === type && new Date(t.date) >= cutoff);
  return recent.reduce((s, t) => s + t.amount, 0) / months;
}

// ─── Main predictCashflow ─────────────────────────────────────────────────────

export function predictCashflow(
  accounts: Account[],
  transactions: Transaction[]
): ExtendedCashflowPrediction {
  const base = transactions.filter(t => !t.generated);

  // 1. Saldo atual: soma dos saldos das contas (se existirem) ou calculado por transações
  const accountBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const txBalance = base
    .filter(t => t.type === TransactionType.RECEITA).reduce((s, t) => s + t.amount, 0) -
    base.filter(t => t.type === TransactionType.DESPESA).reduce((s, t) => s + t.amount, 0);
  const current_balance = accounts.length > 0 ? accountBalance : txBalance;

  // 2. Expandir recorrentes para os próximos 90 dias
  const now = new Date();
  const end90 = addDays(now, 90);
  const recurring = generateRecurringTransactions(base, now, end90);

  // 3. Projeção de fluxo diário com base histórica (para dias sem recorrência)
  const monthlyIncome    = calcMonthlyAvg(base, TransactionType.RECEITA);
  const monthlyExpenses  = calcMonthlyAvg(base, TransactionType.DESPESA);
  const dailyNetBaseline = (monthlyIncome - monthlyExpenses) / 30;

  // 4. Mapear recorrentes por data
  const recurringByDay: Record<string, Transaction[]> = {};
  for (const t of recurring) {
    const key = isoDate(new Date(t.date));
    if (!recurringByDay[key]) recurringByDay[key] = [];
    recurringByDay[key].push(t);
  }

  // 5. Simular saldo dia a dia
  const daily_balances: { date: string; balance: number }[] = [];
  let runningBalance = current_balance;

  for (let d = 0; d < 90; d++) {
    const day = addDays(now, d + 1);
    const key = isoDate(day);
    const dayTxs = recurringByDay[key] ?? [];

    // Aplicar transações recorrentes do dia
    for (const t of dayTxs) {
      runningBalance += t.type === TransactionType.RECEITA ? t.amount : -t.amount;
    }

    // Adicionar variação diária baseline (apenas em dias sem recorrência significativa)
    if (dayTxs.length === 0) {
      runningBalance += dailyNetBaseline;
    }

    daily_balances.push({ date: key, balance: parseFloat(runningBalance.toFixed(2)) });
  }

  // 6. Extrair checkpoints e extremos
  const at = (days: number) => daily_balances[days - 1].balance;
  const firstDailyBalance = daily_balances[0];

  const lowest_point = daily_balances.reduce(
    (min, d) => d.balance < min.balance ? d : min,
    firstDailyBalance
  );
  const highest_point = daily_balances.reduce(
    (max, d) => d.balance > max.balance ? d : max,
    firstDailyBalance
  );

  const result: ExtendedCashflowPrediction = {
    current_balance,
    balance_7_days:  at(7),
    balance_30_days: at(30),
    balance_90_days: at(90),
    projected_income:    monthlyIncome,
    projected_expenses:  monthlyExpenses,
    projected_transactions: recurring,
    daily_balances,
    lowest_point,
    highest_point,
  };

  // Emitir evento de previsão gerada
  FinancialEventEmitter.insightGenerated({
    source: 'cashflow_predictor',
    balance_90_days: result.balance_90_days,
    lowest: result.lowest_point,
  });

  return result;
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

export function formatPredictionLabel(days: number): string {
  if (days === 7)  return 'Em 7 dias';
  if (days === 30) return 'Em 30 dias';
  if (days === 90) return 'Em 90 dias';
  return `Em ${days} dias`;
}

export function predictionTrend(
  current: number,
  future: number
): 'up' | 'down' | 'stable' {
  const pct = current > 0 ? (future - current) / current : 0;
  if (pct > 0.02)  return 'up';
  if (pct < -0.02) return 'down';
  return 'stable';
}
