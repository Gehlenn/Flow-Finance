import { parseOFX } from '../finance/ofxParser';
import { categorizeTransaction, type FinanceCategory } from '../engines/finance/categorization/transactionCategorizer';
import { normalizeImportedTransaction } from './importNormalizer';

export interface TextFileLike {
  name?: string;
  text(): Promise<string>;
}

export interface ImportedStatementTransaction {
  amount: number;
  date: string;
  description: string;
  merchant?: string;
  category: FinanceCategory;
  source: 'import';
  format: 'ofx' | 'csv' | 'pdf';
}

/**
 * Importa arquivo OFX e normaliza para o pipeline interno.
 * Fluxo: arquivo -> parser -> transacoes -> categorizacao
 */
export async function importOFX(file: TextFileLike): Promise<ImportedStatementTransaction[]> {
  const content = await file.text();
  const transactions = parseOFX(content);

  return transactions.map((tx) => {
    const rawTx = tx as unknown as Record<string, unknown> & { amount: number; date: string };
    const normalized = normalizeImportedTransaction({
      amount: rawTx.amount,
      date: rawTx.date,
      description: typeof rawTx.memo === 'string'
        ? rawTx.memo
        : typeof rawTx.description === 'string'
          ? rawTx.description
          : '',
      merchant: typeof rawTx.payee === 'string'
        ? rawTx.payee
        : typeof rawTx.merchant === 'string'
          ? rawTx.merchant
          : '',
    });

    return {
      ...normalized,
      category: categorizeTransaction(normalized.description, normalized.merchant),
      format: 'ofx' as const,
    };
  });
}
