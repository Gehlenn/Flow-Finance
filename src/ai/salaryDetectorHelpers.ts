import { Transaction } from '../../types';

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesKeywords(tx: Transaction, keywords: string[]): boolean {
  const text = normalize(`${tx.description ?? ''} ${tx.merchant ?? ''}`);
  return keywords.some(keyword => text.includes(normalize(keyword)));
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
