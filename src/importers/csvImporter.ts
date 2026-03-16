import { parseCSV } from '../finance/csvParser';
import { categorizeTransaction, type FinanceCategory } from '../engines/finance/categorization/transactionCategorizer';
import type { TextFileLike, ImportedStatementTransaction } from './ofxImporter';
import { normalizeImportedTransaction } from './importNormalizer';

function splitCSVLine(line: string, separator: string): string[] {
  const cols: string[] = [];
  let current = '';
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === separator && !quoted) {
      cols.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cols.push(current.trim());
  return cols;
}

function parseFlexibleCSV(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = lines[0];
  const separator = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
  const headers = splitCSVLine(header, separator);

  return lines.slice(1).map((line) => {
    const cols = splitCSVLine(line, separator);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });
    return row;
  });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return '';
}

/**
 * Importa arquivo CSV e normaliza para o pipeline interno.
 */
export async function importCSV(file: TextFileLike): Promise<ImportedStatementTransaction[]> {
  const content = await file.text();
  const parsedRows = parseFlexibleCSV(content);

  if (parsedRows.length > 0) {
    const mapped = parsedRows
      .map((row) => {
        const normalized = normalizeImportedTransaction({
          amount: pick(row, ['Amount', 'amount', 'Valor', 'valor']),
          date: pick(row, ['Date', 'date', 'Data', 'data']),
          description: pick(row, ['Description', 'description', 'Descricao', 'descricao']),
          merchant: pick(row, ['Merchant', 'merchant', 'Estabelecimento', 'estabelecimento']),
        });

        return {
          ...normalized,
          category: categorizeTransaction(normalized.description, normalized.merchant),
          format: 'csv' as const,
        };
      })
      .filter((tx) => tx.amount > 0 && tx.description.length > 0);

    if (mapped.length > 0) return mapped;
  }

  const transactions = parseCSV(content);
  return transactions.map((tx) => {
    const normalized = normalizeImportedTransaction({
      amount: tx.amount,
      date: tx.date,
      description: tx.description,
      merchant: tx.merchant,
    });

    return {
      ...normalized,
      category: categorizeTransaction(normalized.description, normalized.merchant),
      format: 'csv' as const,
    };
  });
}

export type { FinanceCategory };
