import { categorizeTransaction } from '../engines/finance/categorization/transactionCategorizer';
import type { ImportedStatementTransaction } from './ofxImporter';
import { normalizeImportedTransaction } from './importNormalizer';

const BR_AMOUNT_REGEX = /-?\s*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+\.[0-9]{2})/;
const DATE_REGEX = /(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\-]\d{2}[\-]\d{2})/;

function parsePdfDate(raw: string): string | null {
  const trimmed = raw.trim();
  const formatLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const brMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (brMatch) {
    const year = Number(brMatch[3]);
    const month = Number(brMatch[2]) - 1;
    const day = Number(brMatch[1]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month
      && localDate.getDate() === day
    ) {
      return formatLocalDateKey(localDate);
    }
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month
      && localDate.getDate() === day
    ) {
      return formatLocalDateKey(localDate);
    }
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/g, '');
  if (/\d+\.\d{3},\d{2}/.test(cleaned)) {
    return Math.abs(parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0);
  }
  if (/\d+,\d{2}/.test(cleaned)) {
    return Math.abs(parseFloat(cleaned.replace(',', '.')) || 0);
  }
  return Math.abs(parseFloat(cleaned) || 0);
}

/**
 * Parser simplificado para extratos PDF convertidos em texto.
 * Espera linhas no formato aproximado: "DD/MM/YYYY DESCRICAO R$ 123,45".
 */
export function parsePdfStatementText(text: string): ImportedStatementTransaction[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const transactions: ImportedStatementTransaction[] = [];

  for (const line of lines) {
    const dateMatch = line.match(DATE_REGEX);
    const amountMatch = line.match(BR_AMOUNT_REGEX);
    if (!dateMatch || !amountMatch) continue;

    const date = parsePdfDate(dateMatch[1]);
    if (!date) continue;

    const amount = parseAmount(amountMatch[0]);
    if (!amount) continue;

    const description = line
      .replace(dateMatch[0], '')
      .replace(amountMatch[0], '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!description) continue;

    const normalized = normalizeImportedTransaction({
      amount,
      date,
      description,
      merchant: '',
    });

    transactions.push({
      ...normalized,
      category: categorizeTransaction(normalized.description, normalized.merchant),
      format: 'pdf',
    });
  }

  return transactions;
}
