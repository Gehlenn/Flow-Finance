import { TransactionType } from '../../../types';

export interface ForecastPoint {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface TransactionLike {
  amount: number;
  type: TransactionType;
  date: string;
}

export function buildMonthlyForecast(transactions: TransactionLike[], months = 6): ForecastPoint[] {
  const now = new Date();
  const points: ForecastPoint[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();

    const monthTransactions = transactions.filter((t) => {
      const td = new Date(t.date);
      return td.getFullYear() === y && td.getMonth() === m;
    });

    const receitas = monthTransactions
      .filter((t) => t.type === TransactionType.RECEITA)
      .reduce((sum, t) => sum + t.amount, 0);

    const despesas = monthTransactions
      .filter((t) => t.type === TransactionType.DESPESA)
      .reduce((sum, t) => sum + t.amount, 0);

    points.push({
      month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      receitas,
      despesas,
      saldo: receitas - despesas,
    });
  }

  return points;
}
