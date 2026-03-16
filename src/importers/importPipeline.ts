/**
 * IMPORT PIPELINE — src/importers/importPipeline.ts
 *
 * Orquestrador centralizado de importação de extratos financeiros.
 * Auto-detecta o formato (OFX · CSV · PDF) e retorna transações normalizadas.
 *
 * Fluxo: arquivo → detectar formato → importar → deduplicar → Transaction[]
 */

import { Transaction, TransactionType, Category } from '../../types';
import { importOFX, type TextFileLike, type ImportedStatementTransaction } from './ofxImporter';
import { importCSV } from './csvImporter';
import { importPDFStatement } from './pdfStatementImporter';

export type ImportFormat = 'ofx' | 'csv' | 'pdf' | 'unknown';

export interface PipelineImportResult {
  format: ImportFormat;
  transactions: Transaction[];
  duplicatesSkipped: number;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Detecta o formato de acordo com o nome do arquivo e conteúdo inicial.
 */
export function detectImportFormat(filename: string, contentSnippet: string): ImportFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.ofx') || lower.endsWith('.qfx')) return 'ofx';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return 'csv';
  if (lower.endsWith('.pdf')) return 'pdf';

  // Detecção por conteúdo (fallback)
  const head = contentSnippet.trimStart().slice(0, 200);
  if (/<OFX>|<STMTTRN>|OFXHEADER:/i.test(head)) return 'ofx';
  if (/date|data|amount|valor|description|descricao/i.test(head.split('\n')[0] ?? '')) return 'csv';

  return 'unknown';
}

/**
 * Converte ImportedStatementTransaction → Transaction (domínio interno).
 */
function toTransaction(imp: ImportedStatementTransaction): Transaction {
  return {
    id: makeId(),
    amount: imp.amount,
    type: imp.amount >= 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
    category: (imp.category as unknown as Category) ?? Category.PESSOAL,
    description: imp.description,
    date: imp.date,
    merchant: imp.merchant,
    source: 'import',
  } as Transaction;
}

/**
 * Marca duplicatas comparando com transações já existentes.
 * Critério: mesma data (±1 dia) + mesmo valor + descrição similar (primeiros 8 chars).
 */
export function findDuplicates(
  incoming: Transaction[],
  existing: Transaction[],
): { unique: Transaction[]; duplicatesSkipped: number } {
  const unique: Transaction[] = [];
  let duplicatesSkipped = 0;

  for (const tx of incoming) {
    const isDup = existing.some((ex) => {
      const dateDiff = Math.abs(new Date(ex.date).getTime() - new Date(tx.date).getTime());
      const sameDate = dateDiff < 86_400_000 * 2; // 2 dias de tolerância
      const sameAmt = Math.abs(ex.amount - tx.amount) < 0.01;
      const sameDesc =
        tx.description.length >= 4 &&
        ex.description.toLowerCase().startsWith(tx.description.toLowerCase().slice(0, 8));
      return sameDate && sameAmt && sameDesc;
    });

    if (isDup) {
      duplicatesSkipped++;
    } else {
      unique.push(tx);
    }
  }

  return { unique, duplicatesSkipped };
}

/**
 * Ponto de entrada único do pipeline de importação.
 *
 * @param file             Arquivo ou objeto com `.text()` e `.name`
 * @param existingTxs      Transações já existentes (para deduplicação)
 * @param forceFormat      Força um formato específico (opcional)
 */
export async function runImportPipeline(
  file: TextFileLike & { name?: string },
  existingTxs: Transaction[] = [],
  forceFormat?: ImportFormat,
): Promise<PipelineImportResult> {
  const errors: string[] = [];
  const filename = file.name ?? '';

  // 1. Detectar formato
  let format: ImportFormat = forceFormat ?? 'unknown';
  if (format === 'unknown') {
    const snippet = await file.text().catch(() => '');
    format = detectImportFormat(filename, snippet);
  }

  if (format === 'unknown') {
    return {
      format: 'unknown',
      transactions: [],
      duplicatesSkipped: 0,
      errors: ['Formato de arquivo não reconhecido. Use OFX, CSV ou PDF.'],
    };
  }

  // 2. Importar e categorizar
  let imported: ImportedStatementTransaction[] = [];

  try {
    if (format === 'ofx') {
      imported = await importOFX(file);
    } else if (format === 'csv') {
      imported = await importCSV(file);
    } else if (format === 'pdf') {
      imported = await importPDFStatement(file);
    }
  } catch (err) {
    errors.push(`Erro ao processar arquivo: ${err instanceof Error ? err.message : String(err)}`);
    return { format, transactions: [], duplicatesSkipped: 0, errors };
  }

  // 3. Converter para Transaction[]
  const transactions = imported.map(toTransaction);

  // 4. Deduplicar
  const { unique, duplicatesSkipped } = findDuplicates(transactions, existingTxs);

  return {
    format,
    transactions: unique,
    duplicatesSkipped,
    errors,
  };
}
