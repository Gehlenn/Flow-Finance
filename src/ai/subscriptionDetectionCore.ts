export type SubscriptionBillingCycle = 'monthly' | 'weekly' | 'annual' | 'unknown';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseSubscriptionDate(dateValue: string): number | null {
  const trimmed = dateValue.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnly = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month
      && localDate.getDate() === day
    ) {
      return localDate.getTime();
    }
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

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
): SubscriptionBillingCycle {
  if (dates.length < 2) return 'unknown';

  const sorted = dates
    .map((date) => parseSubscriptionDate(date))
    .filter((time) => !Number.isNaN(time))
    .filter((time): time is number => time !== null)
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
