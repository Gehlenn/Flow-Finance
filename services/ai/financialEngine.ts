/**
 * FINANCIAL ANALYSIS ENGINE — Camada 3 do pipeline de IA
 *
 * Responsabilidades:
 *   1. Expandir transações com recorrências geradas
 *   2. Calcular projeção de fluxo de caixa
 *   3. Calcular resumos por período
 *   4. Retornar um FinancialState unificado para as camadas superiores
 *
 * Fluxo:
 *   Transactions → Expand Recurring → Predict → FinancialState
 */

import { Transaction, TransactionType } from '../../types';
import { expandTransactionsWithRecurring } from '../finance/recurringService';
import { buildCashflowPrediction, CashflowPrediction } from './riskAnalyzer';

// ─── Output type ──────────────────────────────────────────────────────────────

export interface PeriodSummary {
  income: number;
  expenses: number;
  balance: number;
  transaction_count: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export interface FinancialState {
  // Transações expandidas (base + geradas)
  all_transactions: Transaction[];
  base_transactions: Transaction[];
  generated_transactions: Transaction[];

  // Resumos temporais
  summary_all_time: PeriodSummary;
  summary_current_month: PeriodSummary;
  summary_last_month: PeriodSummary;

  // Categorias
  category_breakdown: CategoryBreakdown[];

  // Projeção
  cashflow_prediction: CashflowPrediction;

  // Metadados
  computed_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterByMonth(transactions: Transaction[], monthsAgo: number): Transaction[] {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const to = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d >= from && d <= to;
  });
}

function calcSummary(txs: Transaction[]): PeriodSummary {
  const income = txs
    .filter(t => t.type === TransactionType.RECEITA)
    .reduce((s, t) => s + t.amount, 0);
  const expenses = txs
    .filter(t => t.type === TransactionType.DESPESA)
    .reduce((s, t) => s + t.amount, 0);
  return {
    income,
    expenses,
    balance: income - expenses,
    transaction_count: txs.length,
  };
}

function calcCategoryBreakdown(txs: Transaction[]): CategoryBreakdown[] {
  const expenses = txs.filter(t => t.type === TransactionType.DESPESA);
  const total = expenses.reduce((s, t) => s + t.amount, 0);

  const map: Record<string, { total: number; count: number }> = {};
  for (const t of expenses) {
    if (!map[t.category]) map[t.category] = { total: 0, count: 0 };
    map[t.category].total += t.amount;
    map[t.category].count += 1;
  }

  return Object.entries(map)
    .map(([category, { total, count }]) => ({
      category,
      total,
      count,
      percentage: total > 0 && total > 0 ? parseFloat(((total / (total || 1)) * 100).toFixed(1)) : 0,
    }))
    .map(item => ({
      ...item,
      percentage: total > 0 ? parseFloat(((item.total / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// ─── Main Engine Function ─────────────────────────────────────────────────────

export function runFinancialEngine(transactions: Transaction[]): FinancialState {
  // Janela de análise: 1 ano atrás até 1 ano à frente
  const now = new Date();
  const windowStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const windowEnd = new Date(now.getFullYear() + 1, now.getMonth(), 1);

  const base_transactions = transactions.filter(t => !t.generated);
  const all_transactions = expandTransactionsWithRecurring(base_transactions, windowStart, windowEnd);
  const generated_transactions = all_transactions.filter(t => t.generated);

  const currentMonth = filterByMonth(all_transactions, 0);
  const lastMonth = filterByMonth(all_transactions, 1);

  const cashflow_prediction = buildCashflowPrediction(base_transactions);

  return {
    all_transactions,
    base_transactions,
    generated_transactions,

    summary_all_time: calcSummary(base_transactions),
    summary_current_month: calcSummary(currentMonth),
    summary_last_month: calcSummary(lastMonth),

    category_breakdown: calcCategoryBreakdown(base_transactions),
    cashflow_prediction,
    computed_at: new Date().toISOString(),
  };
}
