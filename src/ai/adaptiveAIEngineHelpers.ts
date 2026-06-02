import { Transaction } from '../../types';

export function parseAdaptiveDate(value: string): Date | null {
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

export function getDaysUntilSalaryDay(salaryDay: number, today = new Date()): number | null {
  if (!Number.isInteger(salaryDay) || salaryDay < 1 || salaryDay > 31) {
    return null;
  }

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let offset = 0; offset <= 62; offset++) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    if (candidate.getDate() === salaryDay) {
      return offset;
    }
  }

  return null;
}

export function getRecentTxs(txs: Transaction[], days: number): Transaction[] {
  const cutoff = new Date(Date.now() - days * 86400000);
  return txs.filter((transaction) => {
    const parsed = parseAdaptiveDate(transaction.date);
    return Boolean(parsed && parsed >= cutoff && !transaction.generated);
  });
}
