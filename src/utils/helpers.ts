// utility helpers shared across the app

import { logWarn } from './logger';

export function makeId(length = 9): string {
  let result = '';

  while (result.length < length) {
    result += Math.random().toString(36).slice(2);
  }

  return result.slice(0, length);
}

export function formatCurrency(
  value: number,
  locale = 'pt-BR',
  options: Intl.NumberFormatOptions = { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number {
  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be a finite number');
  }

  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) return amount;

  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate) {
    throw new Error(`Missing exchange rate for ${!fromRate ? from : to}`);
  }

  // Convert amount to a common base then to target currency.
  const baseAmount = amount / fromRate;
  const converted = baseAmount * toRate;

  // Keep deterministic precision for financial UI calculations.
  return Number(converted.toFixed(2));
}

export function getMonthTransactions<T extends { date: string }>(
  transactions: T[],
  referenceDate: Date = new Date()
): T[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  return transactions.filter(t => {
    const dateOnly = t.date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(t.date);
    if (dateOnly && (
      d.getFullYear() !== Number(dateOnly[1]) ||
      d.getMonth() !== Number(dateOnly[2]) - 1 ||
      d.getDate() !== Number(dateOnly[3])
    )) {
      return false;
    }
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function getFromStorage<T>(key: string, defaultValue: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logWarn('[Helpers] Failed to parse storage entry; returning default value', {
      key,
      error,
    });
    return defaultValue;
  }
}
