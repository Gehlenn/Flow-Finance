import { Transaction } from '../../types';
import { type FixedExpense } from './fixedExpenseDetectorTypes';

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ExpensePatternLike {
  keywords: string[];
  min_amount?: number;
}

export function matchesPattern(tx: Transaction, pattern: ExpensePatternLike): boolean {
  if (pattern.min_amount && tx.amount < pattern.min_amount) return false;
  const text = normalize(`${tx.description ?? ''} ${tx.merchant ?? ''}`);
  return pattern.keywords.some(keyword => text.includes(normalize(keyword)));
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function parseLocalDate(value: string): Date | null {
  const dateOnly = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const localDate = new Date(year, month, day);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function avgDayOfMonth(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const parsedDates = dates.map(parseLocalDate).filter((date): date is Date => Boolean(date));
  if (parsedDates.length < 2) return null;
  const days = parsedDates.map(date => date.getDate());
  const avg = days.reduce((sum, day) => sum + day, 0) / days.length;
  const variance = days.reduce((sum, day) => sum + Math.abs(day - avg), 0) / days.length;
  return variance < 5 ? Math.round(avg) : null;
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
