// utility helpers shared across the app

export function makeId(length = 9): string {
  return Math.random().toString(36).substr(2, length);
}

export function formatCurrency(
  value: number,
  locale = 'pt-BR',
  options: Intl.NumberFormatOptions = { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function getMonthTransactions<T extends { date: string }>(
  transactions: T[],
  referenceDate: Date = new Date()
): T[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function getFromStorage<T>(key: string, defaultValue: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}
