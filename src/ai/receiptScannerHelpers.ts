import { Category, TransactionType } from '../../types';

export function normalizeCategory(raw: string): Category {
  const map: Record<string, Category> = {
    pessoal: Category.PESSOAL,
    trabalho: Category.CONSULTORIO,
    consultório: Category.CONSULTORIO,
    consultorio: Category.CONSULTORIO,
    negócio: Category.NEGOCIO,
    negocio: Category.NEGOCIO,
    investimento: Category.INVESTIMENTO,
  };
  const key = raw.toLowerCase().trim();
  for (const [candidate, category] of Object.entries(map)) {
    if (key.includes(candidate)) return category;
  }
  return Category.PESSOAL;
}

export function normalizeType(raw: string): TransactionType {
  if (raw.toLowerCase().includes('receita') || raw.toLowerCase().includes('recebimento')) {
    return TransactionType.RECEITA;
  }
  return TransactionType.DESPESA;
}

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseReceiptDate(value: string): Date | null {
  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const parsed = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
