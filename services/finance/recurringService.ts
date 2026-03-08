import { Transaction } from '../../types';

/**
 * Adiciona `interval` unidades de acordo com recurrence_type a uma data.
 */
function addInterval(date: Date, type: 'daily' | 'weekly' | 'monthly', interval: number): Date {
  const d = new Date(date);
  switch (type) {
    case 'daily':
      d.setDate(d.getDate() + interval);
      break;
    case 'weekly':
      d.setDate(d.getDate() + interval * 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + interval);
      break;
  }
  return d;
}

/**
 * STEP 1 — Retorna apenas transações marcadas como recorrentes.
 */
export function detectRecurringTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.recurring === true);
}

/**
 * STEP 2 & 3 — Gera instâncias futuras de uma transação recorrente entre startDate e endDate.
 */
export function generateRecurringTransactions(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] {
  const generated: Transaction[] = [];

  const recurring = detectRecurringTransactions(transactions);

  for (const base of recurring) {
    const type = base.recurrence_type ?? 'monthly';
    const interval = base.recurrence_interval ?? 1;
    const origin = new Date(base.date);

    // Avança a partir da data original até entrar no range
    let cursor = addInterval(origin, type, interval);

    // Gera ocorrências dentro do intervalo solicitado
    while (cursor <= endDate) {
      if (cursor >= startDate) {
        const clone: Transaction = {
          ...base,
          id: `${base.id}-rec-${cursor.getTime()}`,
          date: cursor.toISOString(),
          generated: true,
        };
        generated.push(clone);
      }
      cursor = addInterval(cursor, type, interval);
    }
  }

  return generated;
}

/**
 * STEP 4 — Mescla transações originais com as geradas pelo engine de recorrência.
 */
export function expandTransactionsWithRecurring(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] {
  const generated = generateRecurringTransactions(transactions, startDate, endDate);
  const all = [...transactions, ...generated];
  // Ordena por data decrescente
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
