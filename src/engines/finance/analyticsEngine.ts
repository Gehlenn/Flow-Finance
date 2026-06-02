import { Alert, Transaction, TransactionType } from '../../../types';
import { UserContext } from '../../context/UserContext';

export type CashflowTimeframe = '7d' | '30d' | '12m' | 'custom';

function parseAnalyticsDate(value: string): Date | null {
  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const parsed = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAnalyticsDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseAnalyticsDateKey(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = parseAnalyticsDate(value);
  return parsed ? formatAnalyticsDateKey(parsed) : null;
}

export function filterTransactionsByTimeframe(
  transactions: Transaction[],
  timeframe: CashflowTimeframe,
  dateStart?: string,
  dateEnd?: string,
  _userContext?: UserContext
): Transaction[] {
  const now = new Date();

  return transactions.filter((t) => {
    const d = parseAnalyticsDate(t.date);
    if (!d) return false;
    if (timeframe === '7d') return (now.getTime() - d.getTime()) / 86400000 <= 7;
    if (timeframe === '30d') return (now.getTime() - d.getTime()) / 86400000 <= 30;
    if (timeframe === '12m') return d.getFullYear() === now.getFullYear();
    if (timeframe === 'custom') {
      const dStr = formatAnalyticsDateKey(d);
      const startStr = parseAnalyticsDateKey(dateStart) ?? '0000-01-01';
      const endStr = parseAnalyticsDateKey(dateEnd) ?? formatAnalyticsDateKey(now);
      return dStr >= startStr && dStr <= endStr;
    }
    return true;
  });
}

export function buildCashflowTimeline(transactions: Transaction[], _userContext?: UserContext): Array<{
  date: string;
  rawDate: string;
  incoming: number;
  outgoing: number;
}> {
  const dataMap: Record<string, { date: string; rawDate: string; incoming: number; outgoing: number }> = {};

  transactions.forEach((t) => {
    const date = parseAnalyticsDate(t.date);
    if (!date) return;
    const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const rawKey = formatAnalyticsDateKey(date);

    if (!dataMap[key]) {
      dataMap[key] = { date: key, rawDate: rawKey, incoming: 0, outgoing: 0 };
    }

    if (t.type === TransactionType.RECEITA) {
      dataMap[key].incoming += t.amount;
    } else {
      dataMap[key].outgoing += t.amount;
    }
  });

  return Object.values(dataMap).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
}

export function buildExpenseCategoryData(transactions: Transaction[], _userContext?: UserContext): Array<{ name: string; value: number }> {
  const map = transactions
    .filter((t) => t.type === TransactionType.DESPESA)
    .reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

  return Object.keys(map)
    .map((key) => ({ name: key, value: map[key] }))
    .sort((a, b) => b.value - a.value);
}

export function calculateSignedBalance(transactions: Array<{ amount: number; type: TransactionType }>, _userContext?: UserContext): number {
  return transactions.reduce((total, item) => {
    if (item.type === TransactionType.RECEITA) return total + item.amount;
    return total - item.amount;
  }, 0);
}

export function calculateAlertProgress(transactions: Transaction[], alert: Alert, _userContext?: UserContext): { spent: number; percent: number } {
  const spent = transactions
    .filter((t) => t.type === TransactionType.DESPESA && (alert.category === 'Geral' || t.category === alert.category))
    .reduce((sum, t) => sum + t.amount, 0);

  const percent = Math.min((spent / (alert.threshold || 1)) * 100, 100);

  return { spent, percent };
}
