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

function normalizeMerchant(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferFrequency(dates: string[]): 'monthly' | 'unknown' {
  if (dates.length < 3) return 'unknown';

  const sorted = dates
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  if (sorted.length < 3) return 'unknown';

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24));
  }

  const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  return avgGap >= 25 && avgGap <= 35 ? 'monthly' : 'unknown';
}

export function detectSubscriptions(transactions: SubscriptionDetectionInput[]): DetectedSubscription[] {
  const grouped: Record<string, SubscriptionDetectionInput[]> = {};

  for (const tx of transactions) {
    const merchantRaw = tx.merchant || tx.description || '';
    const merchant = normalizeMerchant(merchantRaw);
    if (!merchant) continue;

    const roundedAmount = Math.round(Math.abs(tx.amount) * 100) / 100;
    const key = `${merchant}-${roundedAmount.toFixed(2)}`;

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }

  return Object.values(grouped)
    .filter((group) => group.length >= 3)
    .map((group) => {
      const merchant = normalizeMerchant(group[0].merchant || group[0].description || '');
      const amount = Math.round(Math.abs(group[0].amount) * 100) / 100;
      return {
        merchant,
        amount,
        frequency: inferFrequency(group.map((g) => g.date)),
        occurrences: group.length,
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences);
}
