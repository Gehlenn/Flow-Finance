/**
 * Legacy compatibility wrapper for bank statement import.
 *
 * Canonical flow:
 * - `pages/ImportTransactions.tsx`
 * - `src/finance/importService.ts`
 * - `src/importers/*`
 *
 * This module is kept only for older call sites and tests.
 */

import { Transaction } from '../../../types';
import { Category, TransactionType } from '../../../types';
import {
  detectFormat as detectCanonicalFormat,
  runImportPipeline as runCanonicalImportPipeline,
} from '../../finance/importService';

export type ExtractFormat = 'OFX' | 'CSV' | 'PDF';

export interface ImportResult {
  transactions: Transaction[];
  errors: string[];
}

export async function importExtract(file: File, format: ExtractFormat): Promise<ImportResult> {
  if (!toCanonicalFormat(format)) {
    return { transactions: [], errors: ['Formato não suportado'] };
  }

  const result = await runCanonicalImportPipeline(file, [], 'legacy-import');
  return {
    transactions: result.transactions.map((item) => toTransaction({
      id: `legacy_import_${Math.random().toString(36).slice(2, 10)}`,
      amount: item.raw_amount,
      description: item.raw_description,
      date: item.raw_date,
      merchant: item.merchant,
      category: item.category,
      type: item.type || item.raw_type,
    })),
    errors: result.errors,
  };
}

export async function detectExtractFormat(file: File): Promise<ExtractFormat | 'UNKNOWN'> {
  return toLegacyFormat(await detectCanonicalFormat(file));
}

function toCanonicalFormat(format: ExtractFormat): 'ofx' | 'csv' | 'pdf' | null {
  switch (format) {
    case 'OFX':
      return 'ofx';
    case 'CSV':
      return 'csv';
    case 'PDF':
      return 'pdf';
    default:
      return null;
  }
}

function toLegacyFormat(format: 'ofx' | 'csv' | 'pdf' | 'unknown'): ExtractFormat | 'UNKNOWN' {
  switch (format) {
    case 'ofx':
      return 'OFX';
    case 'csv':
      return 'CSV';
    case 'pdf':
      return 'PDF';
    default:
      return 'UNKNOWN';
  }
}

function toTransaction(input: {
  id: string;
  amount: number;
  description: string;
  date: string;
  merchant?: string;
  category?: string;
  type?: string;
}): Transaction {
  return {
    id: input.id,
    amount: input.amount,
    description: input.description,
    date: input.date,
    merchant: input.merchant,
    source: 'import',
    category: Object.values(Category).includes(input.category as Category)
      ? (input.category as Category)
      : Category.PESSOAL,
    type: Object.values(TransactionType).includes(input.type as TransactionType)
      ? (input.type as TransactionType)
      : TransactionType.DESPESA,
  };
}
