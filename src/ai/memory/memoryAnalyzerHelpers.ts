import type { Transaction } from '../../../types';

export function parseMemoryAnalyzerDate(value: string): Date | null {
  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const parsed = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMemoryAnalyzerDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeMemoryAnalyzerText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function groupBy<T, K extends string | number>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  return groups;
}

export function getExpenseTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((transaction) => transaction.type === 'Despesa' && !transaction.generated);
}

export function getIncomeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((transaction) => transaction.type === 'Receita' && !transaction.generated);
}

export function normalizeMemoryAnalyzerMerchant(transaction: Pick<Transaction, 'merchant' | 'description'>): string {
  return (transaction.merchant || transaction.description).trim().toLowerCase();
}

export function getMemoryAnalyzerDayOfWeek(transaction: Pick<Transaction, 'date'>): number | null {
  return parseMemoryAnalyzerDate(transaction.date)?.getDay() ?? null;
}
