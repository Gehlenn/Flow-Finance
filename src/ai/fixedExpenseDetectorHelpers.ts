import { Transaction } from '../../types';
import { type FixedExpense } from './fixedExpenseDetectorTypes';
import {
  formatLocalDateOnly,
  median,
  normalize,
  parseLocalDate,
} from './recurringPatternHelpers';

interface ExpensePatternLike {
  keywords: string[];
  min_amount?: number;
}

export function matchesPattern(tx: Transaction, pattern: ExpensePatternLike): boolean {
  if (pattern.min_amount && tx.amount < pattern.min_amount) return false;
  const text = normalize(`${tx.description ?? ''} ${tx.merchant ?? ''}`);
  return pattern.keywords.some(keyword => text.includes(normalize(keyword)));
}

export function nextExpectedDate(lastDate: string, dayOfMonth: number | null): string | null {
  const parsed = parseLocalDate(lastDate);
  if (!parsed) return null;
  const next = new Date(parsed);
  next.setMonth(next.getMonth() + 1);
  if (dayOfMonth) next.setDate(Math.min(dayOfMonth, 28));
  return formatLocalDateOnly(next);
}

export function detectAmountTrend(amounts: number[]): FixedExpense['amount_trend'] {
  if (amounts.length < 3) return 'stable';
  const n = amounts.length;
  const sumX = amounts.reduce((sum, _, index) => sum + index, 0);
  const sumY = amounts.reduce((sum, amount) => sum + amount, 0);
  const sumXY = amounts.reduce((sum, amount, index) => sum + index * amount, 0);
  const sumX2 = amounts.reduce((sum, _, index) => sum + index * index, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const pctChange = slope / median(amounts);
  if (pctChange > 0.02) return 'increasing';
  if (pctChange < -0.02) return 'decreasing';
  return 'stable';
}
