/**
 * IMPORT SERVICE - Importação de Extratos Financeiros
 *
 * Suporta: OFX (Open Financial Exchange), CSV, PDF
 * Pipeline: Parse -> Normalizar -> Classificar com IA -> Emitir eventos
 *
 * REGRA: Nunca modifica transações existentes.
 */

import { Category, Transaction, TransactionType } from '../../types';
import { normalizeFromFileImport, draftToTransaction } from '../domain/intakeNormalizer';
import { FinancialEventEmitter } from '../events/eventEngine';
import { learnMemory } from '../ai/aiMemory';
import { classifyTransactionsWithAI } from '../services/ai/categorizationService';
import { logError, logWarn } from '../utils/logger';
import {
  markImportedDuplicates,
  parseCSV as parseCSVImpl,
  parseOFX as parseOFXImpl,
  parsePDF as parsePDFImpl,
} from './importServiceHelpers';
import type { ImportedTransaction, ImportFormat } from './importServiceTypes';

export type { ImportedTransaction, ImportFormat } from './importServiceTypes';

export interface ImportResult {
  format: ImportFormat;
  filename: string;
  total_found: number;
  transactions: ImportedTransaction[];
  errors: string[];
  parse_time_ms: number;
}

export function parseOFX(content: string): ImportedTransaction[] {
  return parseOFXImpl(content);
}

export function parseCSV(content: string): ImportedTransaction[] {
  return parseCSVImpl(content);
}

export async function parsePDF(file: File): Promise<ImportedTransaction[]> {
  return parsePDFImpl(file);
}

export async function classifyImportedTransactions(
  transactions: ImportedTransaction[],
  userId: string,
): Promise<ImportedTransaction[]> {
  if (transactions.length === 0) return transactions;

  const input = transactions.map((t) => ({
    description: t.raw_description,
    amount: t.raw_amount,
    date: t.raw_date,
    type: t.raw_type,
  }));

  try {
    const results = await classifyTransactionsWithAI(input);

    return transactions.map((item, idx) => {
      const r = results[idx];
      const category = r?.category ?? Category.PESSOAL;

      if (item.merchant && (r?.confidence ?? 0) > 0.7) {
        const key = `merchant_${item.merchant.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}`;
        learnMemory(userId, key, category, r.confidence ?? 0.7, { source: 'transação' }).catch((error) => {
          logError('[ImportService] learnMemory error', error, {
            userId,
            merchant: item.merchant,
            fallback: 'import-service-learn-memory-failed',
          });
        });
      }

      const normalizedType = r?.type ?? item.raw_type;

      return {
        ...item,
        category,
        merchant: item.merchant || undefined,
        confidence: r?.confidence ?? 0.5,
        type: normalizedType,
      };
    });
  } catch (error) {
    logWarn('[ImportService] AI classification failed; using default categories', {
      userId,
      transactionCount: transactions.length,
      error,
      fallback: 'import-service-ai-classification-failed',
    });
    return transactions.map((item) => ({
      ...item,
      category: item.category ?? Category.PESSOAL,
      confidence: item.confidence ?? 0.3,
      type: item.type ?? item.raw_type,
    }));
  }
}

export async function detectFormat(file: File): Promise<ImportFormat> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx';
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) return 'csv';
  if (name.endsWith('.pdf')) return 'pdf';

  try {
    const head = await file.slice(0, 200).text();
    if (head.includes('OFXHEADER') || head.includes('<OFX>')) return 'ofx';
    if (head.startsWith('%PDF')) return 'pdf';
  } catch (error) {
    logWarn('[ImportService] Failed to inspect file header; falling back to unknown format', {
      fileName: file.name,
      error,
      fallback: 'import-service-header-inspection-failed',
    });
  }

  return 'unknown';
}

export async function runImportPipeline(
  file: File,
  existingTransactions: Transaction[],
  userId: string,
  onProgress?: (step: string, pct: number) => void,
): Promise<ImportResult> {
  const start = Date.now();
  const errors: string[] = [];
  let transactions: ImportedTransaction[] = [];

  onProgress?.('Detectando formato…', 5);
  const format = await detectFormat(file);

  try {
    if (format === 'ofx') {
      onProgress?.('Lendo OFX…', 20);
      const content = await file.text();
      transactions = parseOFX(content);
    } else if (format === 'csv') {
      onProgress?.('Lendo CSV…', 20);
      const content = await file.text();
      transactions = parseCSV(content);
    } else if (format === 'pdf') {
      onProgress?.('Lendo PDF com parser local…', 20);
      transactions = await parsePDF(file);
    } else {
      onProgress?.('Formato desconhecido - tentando CSV…', 20);
      const content = await file.text();
      transactions = parseCSV(content);
      if (transactions.length === 0) {
        errors.push('Formato não reconhecido. Tente OFX, CSV ou PDF.');
      }
    }

    if (transactions.length === 0) {
      errors.push('Nenhuma transação encontrada no arquivo.');
    }

    onProgress?.('Verificando duplicatas…', 50);
    transactions = markImportedDuplicates(transactions, existingTransactions);

    if (transactions.length > 0) {
      onProgress?.('Classificando com IA…', 65);
      transactions = await classifyImportedTransactions(transactions, userId);
    }
  } catch (error: unknown) {
    const importError = error instanceof Error ? error : new Error('Erro ao processar arquivo.');
    errors.push(importError.message);
  }

  onProgress?.('Concluído!', 100);

  return {
    format,
    filename: file.name,
    total_found: transactions.length,
    transactions,
    errors,
    parse_time_ms: Date.now() - start,
  };
}

export function toTransactions(
  items: ImportedTransaction[],
  accountId?: string,
): Partial<Transaction>[] {
  return items
    .filter((item) => item.selected && !item.duplicate)
    .map((item) => {
      const draft = normalizeFromFileImport({
        amount: item.raw_amount,
        date: item.raw_date,
        description: item.raw_description,
        merchant: item.merchant,
        type: item.type ?? item.raw_type,
        category: item.category,
        confidence: item.confidence,
        source: 'file',
      });

      const normalized = draftToTransaction(draft) as Partial<Transaction>;
      return {
        ...normalized,
        account_id: accountId,
      };
    });
}
