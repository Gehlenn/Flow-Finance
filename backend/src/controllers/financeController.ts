import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import logger from '../config/logger';

// ─── Local Types ─────────────────────────────────────────────────────────────

interface IncomingTransaction {
  id?: string;
  amount: number;
  type: string;   // 'Receita' | 'Despesa'
  category?: string;
  date: string;
}

type BalanceTrend = 'growing' | 'declining' | 'stable';
type FinancialProfile = 'Saver' | 'Spender' | 'Balanced' | 'Risk Taker' | 'Undefined';

interface TimelinePoint {
  date: string;
  income: number;
  expenses: number;
  balance: number;
}

interface FinancialTimeline {
  points: TimelinePoint[];
  totals: { income: number; expenses: number; finalBalance: number };
}

interface TimelineAnomaly {
  date: string;
  type: 'income_spike' | 'expense_spike';
  amount: number;
  ratioToMedian: number;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  share: number;
}

interface FinancialProfileResult {
  profile: FinancialProfile;
  savingsRate: number;
  income: number;
  expenses: number;
  confidence: number;
  topCategories: CategoryBreakdown[];
}

// ─── Pure computation helpers ─────────────────────────────────────────────────

function buildTimeline(transactions: IncomingTransaction[]): FinancialTimeline {
  const grouped = new Map<string, { income: number; expenses: number }>();

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const tx of sorted) {
    const dayKey = new Date(tx.date).toISOString().slice(0, 10);
    if (!grouped.has(dayKey)) grouped.set(dayKey, { income: 0, expenses: 0 });
    const day = grouped.get(dayKey)!;
    if (tx.type === 'Receita') {
      day.income += tx.amount;
    } else {
      day.expenses += tx.amount;
    }
  }

  let runningBalance = 0;
  const points: TimelinePoint[] = Array.from(grouped.entries()).map(([date, v]) => {
    runningBalance += v.income - v.expenses;
    return { date, income: v.income, expenses: v.expenses, balance: runningBalance };
  });

  const totals = points.reduce(
    (acc, p) => { acc.income += p.income; acc.expenses += p.expenses; acc.finalBalance = p.balance; return acc; },
    { income: 0, expenses: 0, finalBalance: 0 }
  );

  return { points, totals };
}

function computeTrend(timeline: FinancialTimeline): BalanceTrend {
  const { points } = timeline;
  if (points.length < 2) return 'stable';

  const n = points.length;
  const balances = points.map((p) => p.balance);
  const xMean = (n - 1) / 2;
  const yMean = balances.reduce((s, b) => s + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (balances[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  if (denominator === 0) return 'stable';
  const slope = numerator / denominator;
  const avgAbs = balances.reduce((s, b) => s + Math.abs(b), 0) / n || 1;
  const normalized = slope / avgAbs;

  if (normalized > 0.05) return 'growing';
  if (normalized < -0.05) return 'declining';
  return 'stable';
}

function computeAnomalies(timeline: FinancialTimeline): TimelineAnomaly[] {
  const { points } = timeline;
  if (points.length === 0) return [];

  const median = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const expMedian = median(points.map((p) => p.expenses).filter((v) => v > 0));
  const incMedian = median(points.map((p) => p.income).filter((v) => v > 0));
  const anomalies: TimelineAnomaly[] = [];

  for (const p of points) {
    if (expMedian > 0 && p.expenses > expMedian * 2) {
      anomalies.push({
        date: p.date,
        type: 'expense_spike',
        amount: p.expenses,
        ratioToMedian: Number((p.expenses / expMedian).toFixed(2)),
      });
    }
    if (incMedian > 0 && p.income > incMedian * 2) {
      anomalies.push({
        date: p.date,
        type: 'income_spike',
        amount: p.income,
        ratioToMedian: Number((p.income / incMedian).toFixed(2)),
      });
    }
  }

  return anomalies;
}

function computeProfile(transactions: IncomingTransaction[]): FinancialProfileResult {
  const income = transactions
    .filter((t) => t.type === 'Receita')
    .reduce((s, t) => s + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.type === 'Despesa')
    .reduce((s, t) => s + t.amount, 0);

  const savingsRate = income > 0 ? (income - expenses) / income : 0;

  const categoryMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'Despesa' || !tx.category) continue;
    categoryMap.set(tx.category, (categoryMap.get(tx.category) ?? 0) + tx.amount);
  }
  const grandTotal = Array.from(categoryMap.values()).reduce((s, v) => s + v, 0);
  const topCategories: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, total]) => ({
      category,
      total: Number(total.toFixed(2)),
      share: grandTotal > 0 ? Number((total / grandTotal).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  if (transactions.length === 0) {
    return { profile: 'Undefined', savingsRate: 0, income: 0, expenses: 0, confidence: 0, topCategories: [] };
  }

  const MIN_TX = 5;
  const confidence = Math.min(
    1,
    (transactions.length / MIN_TX) * 0.6 + (categoryMap.size > 1 ? 0.4 : 0)
  );

  let profile: FinancialProfile;
  if (savingsRate >= 0.2) {
    profile = 'Saver';
  } else if (savingsRate < 0) {
    profile = 'Spender';
  } else if (savingsRate < 0.05) {
    profile = 'Risk Taker';
  } else {
    profile = 'Balanced';
  }

  return {
    profile,
    savingsRate: Number(savingsRate.toFixed(4)),
    income: Number(income.toFixed(2)),
    expenses: Number(expenses.toFixed(2)),
    confidence: Number(confidence.toFixed(4)),
    topCategories,
  };
}

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * POST /api/finance/metrics
 * Computes D3/D4 financial metrics for a provided transactions array.
 *
 * Body: { transactions: IncomingTransaction[] }
 * Returns: { timeline, trend, anomalies, profile }
 */
export const financeMetricsController = asyncHandler(async (req: Request, res: Response) => {
  const { transactions } = req.body as { transactions?: unknown };

  if (!Array.isArray(transactions)) {
    throw new AppError(400, '"transactions" must be an array');
  }

  if (transactions.length > 2000) {
    throw new AppError(400, '"transactions" array too large (max 2000)');
  }

  const userId = req.userId;
  logger.info({ userId, count: transactions.length }, 'finance/metrics requested');

  const sanitized: IncomingTransaction[] = transactions
    .filter(
      (t): t is IncomingTransaction =>
        t !== null &&
        typeof t === 'object' &&
        typeof (t as IncomingTransaction).amount === 'number' &&
        typeof (t as IncomingTransaction).type === 'string' &&
        typeof (t as IncomingTransaction).date === 'string'
    )
    .map((t) => ({
      id: typeof t.id === 'string' ? t.id : undefined,
      amount: Math.abs(t.amount),
      type: t.type,
      category: typeof t.category === 'string' ? t.category : undefined,
      date: t.date,
    }));

  const timeline = buildTimeline(sanitized);
  const trend = computeTrend(timeline);
  const anomalies = computeAnomalies(timeline);
  const profile = computeProfile(sanitized);

  res.json({ timeline, trend, anomalies, profile });
});
