export interface NormalizedImportedTransaction {
  amount: number;
  date: string;
  description: string;
  merchant: string;
  source: 'import';
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseImportedDate(dateValue: unknown): { date: Date; dateOnly: boolean } | null {
  const trimmed = String(dateValue ?? '').trim();
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
      return { date: localDate, dateOnly: true };
    }
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : { date: parsed, dateOnly: false };
}

export function normalizeImportedTransaction(tx: Record<string, unknown>): NormalizedImportedTransaction {
  const amount = Number(tx.amount ?? 0);
  const parsedDate = parseImportedDate(tx.date);

  return {
    amount: Number.isFinite(amount) ? amount : 0,
    date: parsedDate
      ? (parsedDate.dateOnly ? formatLocalDateKey(parsedDate.date) : parsedDate.date.toISOString())
      : new Date().toISOString(),
    description: String(tx.description ?? '').trim(),
    merchant: String(tx.merchant ?? '').trim(),
    source: 'import',
  };
}
