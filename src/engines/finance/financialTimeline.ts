import { Transaction, TransactionType } from '../../../types';

export interface TimelinePoint {
  date: string;
  income: number;
  expenses: number;
  balance: number;
}

export interface FinancialTimeline {
  points: TimelinePoint[];
  totals: {
    income: number;
    expenses: number;
    finalBalance: number;
  };
}

export type BalanceTrend = 'growing' | 'declining' | 'stable';

export interface MonthlyAggregate {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  savingsRate: number;
}

export interface TimelineAnomaly {
  date: string;
  type: 'income_spike' | 'expense_spike' | 'no_income';
  amount: number;
  ratioToMedian: number;
}

export function buildFinancialTimeline(transactions: Transaction[]): FinancialTimeline {
  const grouped = new Map<string, { income: number; expenses: number }>();

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const tx of sorted) {
    const dayKey = new Date(tx.date).toISOString().slice(0, 10);
    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, { income: 0, expenses: 0 });
    }

    const day = grouped.get(dayKey)!;
    if (tx.type === TransactionType.RECEITA) {
      day.income += tx.amount;
    } else {
      day.expenses += tx.amount;
    }
  }

  let runningBalance = 0;
  const points: TimelinePoint[] = Array.from(grouped.entries()).map(([date, values]) => {
    runningBalance += values.income - values.expenses;
    return {
      date,
      income: values.income,
      expenses: values.expenses,
      balance: runningBalance,
    };
  });

  const totals = points.reduce(
    (acc, p) => {
      acc.income += p.income;
      acc.expenses += p.expenses;
      acc.finalBalance = p.balance;
      return acc;
    },
    { income: 0, expenses: 0, finalBalance: 0 }
  );

  return { points, totals };
}

/**
 * Agrega transações por mês (YYYY-MM), calculando income, expenses, balance e savingsRate.
 */
export function aggregateByMonth(transactions: Transaction[]): MonthlyAggregate[] {
  const monthMap = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) monthMap.set(key, { income: 0, expenses: 0 });
    const entry = monthMap.get(key)!;
    if (tx.type === TransactionType.RECEITA) {
      entry.income += tx.amount;
    } else {
      entry.expenses += tx.amount;
    }
  }

  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, { income, expenses }]) => {
      const balance = income - expenses;
      const savingsRate = income > 0 ? (balance / income) : 0;
      return {
        month,
        income: Number(income.toFixed(2)),
        expenses: Number(expenses.toFixed(2)),
        balance: Number(balance.toFixed(2)),
        savingsRate: Number(savingsRate.toFixed(4)),
      };
    });
}

/**
 * Detecta tendência com base nos últimos pontos da timeline.
 * Usa regressão linear simples sobre o saldo acumulado.
 */
export function detectBalanceTrend(timeline: FinancialTimeline): BalanceTrend {
  const points = timeline.points;
  if (points.length < 2) return 'stable';

  const n = points.length;
  const balances = points.map((p) => p.balance);
  const xMean = (n - 1) / 2;
  const yMean = balances.reduce((sum, b) => sum + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (balances[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  if (denominator === 0) return 'stable';
  const slope = numerator / denominator;

  // Threshold: variação relativa ao saldo médio absoluto
  const avgAbsBalance = balances.reduce((sum, b) => sum + Math.abs(b), 0) / n || 1;
  const normalizedSlope = slope / avgAbsBalance;

  if (normalizedSlope > 0.05) return 'growing';
  if (normalizedSlope < -0.05) return 'declining';
  return 'stable';
}

/**
 * Detecta anomalias na timeline: picos de receita/despesa (>2x mediana) e dias sem receita.
 */
export function detectTimelineAnomalies(timeline: FinancialTimeline): TimelineAnomaly[] {
  const points = timeline.points;
  if (points.length === 0) return [];

  const expenseValues = points.map((p) => p.expenses).filter((v) => v > 0).sort((a, b) => a - b);
  const incomeValues = points.map((p) => p.income).filter((v) => v > 0).sort((a, b) => a - b);

  const median = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const expenseMedian = median(expenseValues);
  const incomeMedian = median(incomeValues);

  const anomalies: TimelineAnomaly[] = [];

  for (const point of points) {
    if (expenseMedian > 0 && point.expenses > expenseMedian * 2) {
      anomalies.push({
        date: point.date,
        type: 'expense_spike',
        amount: point.expenses,
        ratioToMedian: Number((point.expenses / expenseMedian).toFixed(2)),
      });
    }

    if (incomeMedian > 0 && point.income > incomeMedian * 2) {
      anomalies.push({
        date: point.date,
        type: 'income_spike',
        amount: point.income,
        ratioToMedian: Number((point.income / incomeMedian).toFixed(2)),
      });
    }

    if (point.expenses > 0 && point.income === 0) {
      anomalies.push({
        date: point.date,
        type: 'no_income',
        amount: point.expenses,
        ratioToMedian: 0,
      });
    }
  }

  return anomalies;
}
