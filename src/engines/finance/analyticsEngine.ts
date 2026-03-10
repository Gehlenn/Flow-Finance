import { Alert, Transaction, TransactionType } from '../../../types';

export type CashflowTimeframe = '7d' | '30d' | '12m' | 'custom';

export function filterTransactionsByTimeframe(
  transactions: Transaction[],
  timeframe: CashflowTimeframe,
  dateStart?: string,
  dateEnd?: string
): Transaction[] {
  const now = new Date();

  return transactions.filter((t) => {
    const d = new Date(t.date);
    if (timeframe === '7d') return (now.getTime() - d.getTime()) / 86400000 <= 7;
    if (timeframe === '30d') return (now.getTime() - d.getTime()) / 86400000 <= 30;
    if (timeframe === '12m') return d.getFullYear() === now.getFullYear();
    if (timeframe === 'custom') {
      const start = dateStart ? new Date(`${dateStart}T00:00:00`) : new Date(0);
      const end = dateEnd ? new Date(`${dateEnd}T23:59:59`) : new Date();
      return d >= start && d <= end;
    }
    return true;
  });
}

export function buildCashflowTimeline(transactions: Transaction[]): Array<{
  date: string;
  rawDate: string;
  incoming: number;
  outgoing: number;
}> {
  const dataMap: Record<string, { date: string; rawDate: string; incoming: number; outgoing: number }> = {};

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const rawKey = date.toISOString().split('T')[0];

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

export function buildExpenseCategoryData(transactions: Transaction[]): Array<{ name: string; value: number }> {
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

export function calculateSignedBalance(transactions: Array<{ amount: number; type: TransactionType }>): number {
  return transactions.reduce((total, item) => {
    if (item.type === TransactionType.RECEITA) return total + item.amount;
    return total - item.amount;
  }, 0);
}

export function calculateAlertProgress(transactions: Transaction[], alert: Alert): { spent: number; percent: number } {
  const spent = transactions
    .filter((t) => t.type === TransactionType.DESPESA && (alert.category === 'Geral' || t.category === alert.category))
    .reduce((sum, t) => sum + t.amount, 0);

  const percent = Math.min((spent / (alert.threshold || 1)) * 100, 100);

  return { spent, percent };
}
