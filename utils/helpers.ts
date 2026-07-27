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

export function now(): string {
  return new Date().toISOString();
}
