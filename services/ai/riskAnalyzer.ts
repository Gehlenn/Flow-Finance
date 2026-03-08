import { Transaction, TransactionType } from '../../types';

// ─── Model (PART 4) ───────────────────────────────────────────────────────────

export interface FinancialRiskAlert {
  id: string;
  type: 'low_balance' | 'spending_acceleration' | 'negative_forecast';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CashflowPrediction {
  current_balance: number;
  balance_7_days: number;
  balance_30_days: number;
  projected_income: number;
  projected_expenses: number;
}

// ─── Build prediction from transactions ──────────────────────────────────────

export function buildCashflowPrediction(transactions: Transaction[]): CashflowPrediction {
  const baseTxs = transactions.filter(t => !t.generated);

  const totalIncome = baseTxs
    .filter(t => t.type === TransactionType.RECEITA)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = baseTxs
    .filter(t => t.type === TransactionType.DESPESA)
    .reduce((sum, t) => sum + t.amount, 0);

  const current_balance = totalIncome - totalExpenses;

  // Média mensal de receitas e despesas (últimos 3 meses)
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const recent = baseTxs.filter(t => new Date(t.date) >= threeMonthsAgo);

  const monthlyIncome = recent
    .filter(t => t.type === TransactionType.RECEITA)
    .reduce((sum, t) => sum + t.amount, 0) / 3;

  const monthlyExpenses = recent
    .filter(t => t.type === TransactionType.DESPESA)
    .reduce((sum, t) => sum + t.amount, 0) / 3;

  const dailyNet = (monthlyIncome - monthlyExpenses) / 30;

  return {
    current_balance,
    balance_7_days: current_balance + dailyNet * 7,
    balance_30_days: current_balance + dailyNet * 30,
    projected_income: monthlyIncome,
    projected_expenses: monthlyExpenses,
  };
}

// ─── PART 5: detectFinancialRisks ────────────────────────────────────────────

export function detectFinancialRisks(prediction: CashflowPrediction): FinancialRiskAlert[] {
  const alerts: FinancialRiskAlert[] = [];
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // ── 1. Previsão negativa em 30 dias ──────────────────────────────────────
  if (prediction.balance_30_days < 0) {
    alerts.push({
      id: Math.random().toString(36).substr(2, 9),
      type: 'negative_forecast',
      message: `Seu saldo pode ficar negativo nos próximos 30 dias (projeção: ${fmt(prediction.balance_30_days)}).`,
      severity: 'high',
    });
  }

  // ── 2. Aceleração de gastos ───────────────────────────────────────────────
  if (
    prediction.projected_expenses > 0 &&
    prediction.projected_income > 0 &&
    prediction.projected_expenses > prediction.projected_income * 1.3
  ) {
    alerts.push({
      id: Math.random().toString(36).substr(2, 9),
      type: 'spending_acceleration',
      message: `Seus gastos projetados (${fmt(prediction.projected_expenses)}) excedem significativamente suas receitas.`,
      severity: 'medium',
    });
  }

  // ── 3. Saldo baixo em 7 dias ──────────────────────────────────────────────
  if (
    prediction.current_balance > 0 &&
    prediction.balance_7_days < prediction.current_balance * 0.2
  ) {
    alerts.push({
      id: Math.random().toString(36).substr(2, 9),
      type: 'low_balance',
      message: `Em 7 dias seu saldo pode cair para ${fmt(prediction.balance_7_days)} — abaixo de 20% do atual.`,
      severity: 'medium',
    });
  }

  return alerts;
}
