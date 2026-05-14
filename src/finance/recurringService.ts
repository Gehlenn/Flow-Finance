import { Transaction } from '../../types';

function parseRecurringDate(value: string): Date | null {
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

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    const origin = parseRecurringDate(base.date);
    if (!origin) continue;

    // Avança a partir da data original até entrar no range
    let cursor = addInterval(origin, type, interval);

    // Gera ocorrências dentro do intervalo solicitado
    while (cursor <= endDate) {
      if (cursor >= startDate) {
        const clone: Transaction = {
          ...base,
          id: `${base.id}-rec-${cursor.getTime()}`,
          date: formatLocalDateKey(cursor),
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
  return all.sort((a, b) => {
    const left = parseRecurringDate(a.date);
    const right = parseRecurringDate(b.date);
    if (!left && !right) return b.date.localeCompare(a.date);
    if (!left) return 1;
    if (!right) return -1;
    return right.getTime() - left.getTime();
  });
}
