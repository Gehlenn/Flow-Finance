import { Transaction } from '../../types';
import {
  formatLocalDateOnly,
  normalize,
  parseLocalDate,
} from './recurringPatternHelpers';

export function matchesKeywords(tx: Transaction, keywords: readonly string[]): boolean {
  const text = normalize(`${tx.description ?? ''} ${tx.merchant ?? ''}`);
  return keywords.some(keyword => text.includes(normalize(keyword)));
}

export function nextExpectedDate(lastDate: string, dayOfMonth: number | null): string | null {
  const parsed = parseLocalDate(lastDate);
  if (!parsed) return null;
  const next = new Date(parsed);
  next.setMonth(next.getMonth() + 1);
  if (dayOfMonth) next.setDate(dayOfMonth);
  return formatLocalDateOnly(next);
}

export function isRegularInterval(dates: string[], targetDays: number, toleranceDays: number): boolean {
  if (dates.length < 2) return false;
  const sorted = [...dates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const currentDate = parseLocalDate(sorted[i]);
    const previousDate = parseLocalDate(sorted[i - 1]);
    if (!currentDate || !previousDate) continue;
    gaps.push((currentDate.getTime() - previousDate.getTime()) / 86400000);
  }
  if (gaps.length === 0) return false;
  const avg = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return Math.abs(avg - targetDays) <= toleranceDays;
}
