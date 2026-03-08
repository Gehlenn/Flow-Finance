/**
 * FINANCIAL LEAK DETECTION — Detecção de vazamentos financeiros
 *
 * Detecta pequenos gastos recorrentes que podem estar "vazando" dinheiro.
 */

import { Transaction, TransactionType } from '../../types';

export interface FinancialLeak {
  merchant: string;
  occurrences: number;
  monthly_cost: number;
  suggestion: string;
}

/**
 * Detecta vazamentos financeiros em transações.
 */
export function detectFinancialLeaks(transactions: Transaction[]): FinancialLeak[] {
  const leaks: FinancialLeak[] = [];
  const merchantGroups: Record<string, Transaction[]> = {};

  // Filtrar apenas despesas e agrupar por merchant
  for (const tx of transactions) {
    if (tx.type !== TransactionType.DESPESA || !tx.merchant) continue;
    const merchant = tx.merchant.toLowerCase().trim();
    if (!merchantGroups[merchant]) merchantGroups[merchant] = [];
    merchantGroups[merchant].push(tx);
  }

  // Analisar cada grupo
  for (const [merchant, txs] of Object.entries(merchantGroups)) {
    if (txs.length < 3) continue; // precisa de pelo menos 3 ocorrências

    // Calcular média e frequência
    const amounts = txs.map(t => t.amount);
    const avgAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length;

    if (avgAmount > 50) continue; // só pequenos gastos

    // Verificar recorrência (pelo menos semanal ou mensal)
    const dates = txs.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(dates[i] - dates[i-1]);
    }
    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const daysInterval = avgInterval / (1000 * 60 * 60 * 24);

    let monthlyCost = 0;
    let suggestion = '';

    if (daysInterval <= 7) { // semanal
      monthlyCost = avgAmount * 4.3; // ~4.3 semanas por mês
      suggestion = `Gasto semanal de ${avgAmount.toFixed(2)} em ${merchant}. Considere reduzir ou cancelar.`;
    } else if (daysInterval <= 31) { // mensal
      monthlyCost = avgAmount;
      suggestion = `Gasto mensal recorrente de ${avgAmount.toFixed(2)} em ${merchant}. Avalie se é necessário.`;
    } else {
      continue; // não recorrente o suficiente
    }

    leaks.push({
      merchant,
      occurrences: txs.length,
      monthly_cost: monthlyCost,
      suggestion,
    });
  }

  return leaks.sort((a, b) => b.monthly_cost - a.monthly_cost);
}