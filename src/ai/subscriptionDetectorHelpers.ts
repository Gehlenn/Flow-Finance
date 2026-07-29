import { Transaction } from '../../types';
import { inferSubscriptionCycleFromDates, normalizeSubscriptionText, roundSubscriptionAmount } from './subscriptionDetectionCore';
import type { SubscriptionBillingCycle } from './subscriptionDetectionCore';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseSubscriptionDate(value: string): Date | null {
  const trimmed = value.trim();
  const dateOnly = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const localDate = new Date(year, month, day);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function estimateNextCharge(lastDate: string, cycle: SubscriptionBillingCycle): string | null {
  const d = parseSubscriptionDate(lastDate);
  if (!d) return null;

  if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (cycle === 'weekly') d.setDate(d.getDate() + 7);
  else if (cycle === 'annual') d.setFullYear(d.getFullYear() + 1);
  else return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function detectCycle(transactions: Transaction[]): SubscriptionBillingCycle {
  return inferSubscriptionCycleFromDates(transactions.map((transaction) => transaction.date));
}

export function txMatchesService(
  tx: Transaction,
  service: { keywords: string[] },
): boolean {
  const desc = normalizeSubscriptionText(tx.description ?? '');
  const merch = normalizeSubscriptionText(tx.merchant ?? '');
  return service.keywords.some((kw) => desc.includes(kw) || merch.includes(kw));
}

export function groupTransactionsByAmount(transactions: Transaction[]): Transaction[][] {
  const groups: Record<string, Transaction[]> = {};

  for (const transaction of transactions) {
    const key = roundSubscriptionAmount(transaction.amount).toFixed(2);
    if (!groups[key]) groups[key] = [];
    groups[key].push(transaction);
  }

  return Object.values(groups);
}
