import {
  inferSubscriptionCycleFromDates,
  normalizeSubscriptionMerchantName,
  roundSubscriptionAmount,
} from '../../../ai/subscriptionDetectionCore';

export interface SubscriptionDetectionInput {
  merchant?: string;
  description?: string;
  amount: number;
  date: string;
}

export interface DetectedSubscription {
  merchant: string;
  amount: number;
  frequency: 'monthly' | 'unknown';
  occurrences: number;
}

function toCompatibilityFrequency(
  cycle: ReturnType<typeof inferSubscriptionCycleFromDates>,
): 'monthly' | 'unknown' {
  return cycle === 'monthly' ? 'monthly' : 'unknown';
}

function buildGroupingKey(transaction: SubscriptionDetectionInput): string | null {
  const merchant = normalizeSubscriptionMerchantName(transaction);
  if (!merchant) return null;

  return `${merchant}-${roundSubscriptionAmount(transaction.amount).toFixed(2)}`;
}

export function detectSubscriptions(
  transactions: SubscriptionDetectionInput[],
): DetectedSubscription[] {
  const grouped: Record<string, SubscriptionDetectionInput[]> = {};

  for (const transaction of transactions) {
    const key = buildGroupingKey(transaction);
    if (!key) continue;

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(transaction);
  }

  return Object.values(grouped)
    .filter((group) => group.length >= 3)
    .map((group) => ({
      merchant: normalizeSubscriptionMerchantName(group[0]),
      amount: roundSubscriptionAmount(group[0].amount),
      frequency: toCompatibilityFrequency(
        inferSubscriptionCycleFromDates(group.map((transaction) => transaction.date)),
      ),
      occurrences: group.length,
    }))
    .sort((left, right) => right.occurrences - left.occurrences);
}
