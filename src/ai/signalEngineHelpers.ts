import { Transaction, TransactionType } from '../../types';
import type { FinancialSignalKind } from './signalEngineTypes';
import type { FinancialRiskAlert } from './riskAnalyzer';

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseSignalDate(value: string): Date | null {
  const trimmed = value.trim();
  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const parsed = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMonthTransactions(transactions: Transaction[], monthsAgo: number): Transaction[] {
  const current = new Date();
  const from = new Date(current.getFullYear(), current.getMonth() - monthsAgo, 1);
  const to = new Date(current.getFullYear(), current.getMonth() - monthsAgo + 1, 0, 23, 59, 59);

  return transactions.filter((transaction) => {
    const parsed = parseSignalDate(transaction.date);
    return Boolean(parsed && parsed >= from && parsed <= to);
  });
}

export function totalExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((transaction) => transaction.type === TransactionType.DESPESA && !transaction.generated)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function classifyRiskType(kind: FinancialSignalKind): FinancialRiskAlert['type'] {
  switch (kind) {
    case 'projected_gap':
      return 'negative_forecast';
    case 'cash_warning':
      return 'low_balance';
    default:
      return 'spending_acceleration';
  }
}

export function getSeverityRank(severity: 'urgent' | 'attention' | 'info'): number {
  if (severity === 'urgent') return 0;
  if (severity === 'attention') return 1;
  return 2;
}
