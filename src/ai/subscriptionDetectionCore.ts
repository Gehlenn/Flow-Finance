export type SharedSubscriptionCycle = 'monthly' | 'weekly' | 'annual' | 'unknown';

export function normalizeSubscriptionText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSubscriptionMerchantName(input: {
  merchant?: string | null;
  description?: string | null;
}): string {
  return normalizeSubscriptionText(input.merchant || input.description || '');
}

export function roundSubscriptionAmount(amount: number): number {
  return Math.round(Math.abs(amount) * 100) / 100;
}

export function inferSubscriptionCycleFromDates(
  dates: string[],
): SharedSubscriptionCycle {
  if (dates.length < 2) return 'unknown';

  const sorted = dates
    .map((date) => new Date(date).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b);

  if (sorted.length < 2) return 'unknown';

  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    gaps.push((sorted[index] - sorted[index - 1]) / 86400000);
  }

  const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

  if (averageGap >= 25 && averageGap <= 35) return 'monthly';
  if (averageGap >= 5 && averageGap <= 10) return 'weekly';
  if (averageGap >= 350 && averageGap <= 380) return 'annual';
  return 'unknown';
}
