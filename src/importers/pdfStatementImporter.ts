import { categorizeTransaction } from '../engines/finance/categorization/transactionCategorizer';
import type { TextFileLike, ImportedStatementTransaction } from './ofxImporter';
import { normalizeImportedTransaction } from './importNormalizer';

export interface PdfTextExtractor {
  extractText(file: TextFileLike): Promise<string>;
}

const BR_AMOUNT_REGEX = /-?\s*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+\.[0-9]{2})/;
const DATE_REGEX = /(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\-]\d{2}[\-]\d{2})/;

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

    const date = dateMatch[1].includes('/')
      ? new Date(dateMatch[1].split('/').reverse().join('-')).toISOString()
      : new Date(dateMatch[1]).toISOString();

    const amount = parseAmount(amountMatch[0]);
    if (!amount || Number.isNaN(new Date(date).getTime())) continue;

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

export async function importPDFStatement(
  file: TextFileLike,
  extractor?: PdfTextExtractor,
): Promise<ImportedStatementTransaction[]> {
  const text = extractor ? await extractor.extractText(file) : await file.text();
  return parsePdfStatementText(text);
}
