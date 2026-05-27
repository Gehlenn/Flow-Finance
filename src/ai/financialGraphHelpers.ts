export function makeCacheKey(userId: string, txCount: number, accCount: number): string {
  return `${userId}:${txCount}:${accCount}`;
}

export function nodeId(type: string, key: string): string {
  return `${type}:${key.toLowerCase().replace(/\s+/g, '_').slice(0, 40)}`;
}

export function parseGraphDate(value: string): Date | null {
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

export function formatGraphDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
