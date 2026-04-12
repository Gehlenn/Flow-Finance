/**
 * IMPORT SERVICE — Importação de Extratos Financeiros
 *
 * Suporta: OFX (Open Financial Exchange), CSV, PDF
 * Pipeline: Parse → Normalizar → Classificar com IA → Emitir eventos
 *
 * REGRA: Nunca modifica transações existentes.
 */

import { Transaction, TransactionType, Category } from '../../types';
import { normalizeFromFileImport, draftToTransaction } from '../domain/intakeNormalizer';
import { FinancialEventEmitter } from '../events/eventEngine';
import { learnMemory } from '../ai/aiMemory';
import { parsePdfStatementText } from '../importers/pdfStatementImporter';
import { classifyTransactionsWithAI } from '../services/ai/categorizationService';

// ─── Import result model ──────────────────────────────────────────────────────

export type ImportFormat = 'ofx' | 'csv' | 'pdf' | 'unknown';

export interface ImportedTransaction {
  // Dados extraídos do arquivo
  raw_date: string;
  raw_amount: number;
  raw_description: string;
  raw_type?: TransactionType;

  // Dados classificados pela IA
  category?: Category;
  merchant?: string;
  type?: TransactionType;
  confidence?: number;

  // Estado de seleção para a UI
  selected: boolean;
  duplicate?: boolean;      // detectado como possível duplicata
}

export interface ImportResult {
  format: ImportFormat;
  filename: string;
  total_found: number;
  transactions: ImportedTransaction[];
  errors: string[];
  parse_time_ms: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tenta parsear uma data em vários formatos e retorna ISO string */
function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString();

  const cleaned = raw.trim();

  // OFX: YYYYMMDD or YYYYMMDDHHMMSS[.mmm][±hh:mm]
  const ofxMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    return new Date(`${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`).toISOString();
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = cleaned.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (brMatch) {
    return new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`).toISOString();
  }

  // MM/DD/YYYY (US format)
  const usMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (usMatch) {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // ISO 8601 — YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(cleaned).toISOString();
  }

  // Fallback
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Normaliza valor: aceita "1.234,56", "1,234.56", "1234.56", "-R$12,00" */
function parseAmount(raw: string | number): number {
  if (typeof raw === 'number') return Math.abs(raw);
  const s = String(raw).replace(/[R$\s]/g, '');
  // Detectar separador decimal: se tiver vírgula depois de ponto → BR
  const hasBrFormat = s.match(/\.\d{3},\d{2}/);
  if (hasBrFormat) {
    return Math.abs(parseFloat(s.replace(/\./g, '').replace(',', '.')));
  }
  return Math.abs(parseFloat(s.replace(',', '')));
}

function parseSignedAmount(raw: string | number): number {
  if (typeof raw === 'number') return raw;

  const source = String(raw).trim();
  const negative = source.includes('-');
  const normalized = source.replace(/[R$\s+-]/g, '');

  let absolute: number;
  if (/\.\d{3},\d{2}/.test(normalized)) {
    absolute = parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d+,\d{2}$/.test(normalized)) {
    absolute = parseFloat(normalized.replace(',', '.'));
  } else if (/^\d+\.\d{2}$/.test(normalized)) {
    absolute = parseFloat(normalized);
  } else {
    absolute = parseFloat(normalized.replace(',', ''));
  }

  return (negative ? -1 : 1) * absolute;
}

/** Detecta tipo por sinal ou palavras-chave */
function inferType(raw: string, amount: number, signedAmount?: number): TransactionType {
  // Sinal negativo = despesa
  if (signedAmount !== undefined && signedAmount < 0) return TransactionType.DESPESA;
  if (signedAmount !== undefined && signedAmount > 0) return TransactionType.RECEITA;

  const lower = raw.toLowerCase();
  const incomeKw = ['salário', 'salario', 'receita', 'crédito', 'credito', 'pix recebido',
                    'transferência recebida', 'deposito', 'depósito', 'rendimento', 'juros'];
  if (incomeKw.some(kw => lower.includes(kw))) return TransactionType.RECEITA;
  return TransactionType.DESPESA;
}

/** Detecta possíveis duplicatas contra transações existentes */
function markDuplicates(
  imported: ImportedTransaction[],
  existing: Transaction[]
): ImportedTransaction[] {
  return imported.map(item => {
    const dup = existing.some(ex => {
      const sameDate = Math.abs(new Date(ex.date).getTime() - new Date(item.raw_date).getTime()) < 86400000 * 2;
      const sameAmt  = Math.abs(ex.amount - item.raw_amount) < 0.01;
      const sameDesc = ex.description.toLowerCase().includes(item.raw_description.toLowerCase().slice(0, 8));
      return sameDate && sameAmt && sameDesc;
    });
    return { ...item, duplicate: dup };
  });
}

// ─── PART 2 — OFX Parser ─────────────────────────────────────────────────────

export function parseOFX(content: string): ImportedTransaction[] {
  const results: ImportedTransaction[] = [];
  const trimmed = content.trimStart();

  // Suporta OFX/QFX SGML (não XML) e OFX XML
  const isXml = trimmed.startsWith('<?xml') || /<\/(DTPOSTED|DTUSER|TRNAMT|MEMO|NAME|AMOUNT)>/i.test(content);

  if (isXml) {
    // XML OFX: usar regex para extrair STMTTRNs
    const txBlocks = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) ?? [];
    for (const block of txBlocks) {
      const get = (tag: string) =>
        block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`, 'i'))?.[1]?.trim() ?? '';

      const rawAmt = get('TRNAMT') || get('AMOUNT');
      const signedAmt = parseFloat(rawAmt.replace(',', '.'));
      const amount = Math.abs(signedAmt);
      if (!amount) continue;

      results.push({
        raw_date:        parseDate(get('DTPOSTED') || get('DTUSER')),
        raw_amount:      amount,
        raw_description: get('MEMO') || get('NAME') || get('TRNTYPE'),
        raw_type:        signedAmt < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
        selected: true,
      });
    }
  } else {
    // SGML OFX: line-by-line tags
    const lines = content.split(/\r?\n/).map(l => l.trim());
    let currentTx: Partial<ImportedTransaction & { _date?: string; _amt?: string; _memo?: string; _name?: string }> = {};
    let inTx = false;

    for (const line of lines) {
      if (line === '<STMTTRN>') { inTx = true; currentTx = {}; continue; }
      if (line === '</STMTTRN>' && inTx) {
        const rawAmt = (currentTx as any)._amt ?? '0';
        const signedAmt = parseSignedAmount(rawAmt);
        const amount = Math.abs(signedAmt);
        if (amount > 0) {
          results.push({
            raw_date:        parseDate((currentTx as any)._date ?? ''),
            raw_amount:      amount,
            raw_description: ((currentTx as any)._memo || (currentTx as any)._name || 'Transação importada').trim(),
            raw_type:        signedAmt < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
            selected: true,
          });
        }
        inTx = false;
        continue;
      }

      const tagMatch = line.match(/^<([^>]+)>(.*)$/);
      if (!tagMatch) {
        continue;
      }

      const [, tag, value] = tagMatch;
      if (!inTx) continue;
      const tagUpper = tag.toUpperCase();
      if (tagUpper === 'DTPOSTED' || tagUpper === 'DTUSER') (currentTx as any)._date = value;
      else if (tagUpper === 'TRNAMT')                        (currentTx as any)._amt  = value;
      else if (tagUpper === 'MEMO')                          (currentTx as any)._memo = value;
      else if (tagUpper === 'NAME')                          (currentTx as any)._name = value;
    }
  }

  return results;
}

// ─── PART 3 — CSV Parser ─────────────────────────────────────────────────────

export function parseCSV(content: string): ImportedTransaction[] {
  const results: ImportedTransaction[] = [];
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return results;

  // Detectar separador: ; | , | \t
  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

  const splitLine = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === sep && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());

  // Mapear colunas flexivelmente
  const findCol = (...candidates: string[]) =>
    candidates.reduce((found, c) =>
      found >= 0 ? found : headers.findIndex(h => h.includes(c)), -1);

  const colDate  = findCol('data', 'date', 'dt');
  const colDesc  = findCol('descricao', 'descri', 'historico', 'memo', 'description', 'estabelecimento', 'lancamento');
  const colAmt   = findCol('valor', 'amount', 'value', 'quantia');
  const colDebit = findCol('debito', 'saida', 'debit', 'despesa');
  const colCredit= findCol('credito', 'entrada', 'credit', 'receita');
  const colType  = findCol('tipo', 'type', 'natureza');
  const colMerch = findCol('estabeleci', 'merchant', 'loja', 'empresa');

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 2) continue;

    const rawDate = colDate >= 0 ? cols[colDate] : '';
    const rawDesc = colDesc >= 0 ? cols[colDesc] : cols[1] ?? '';

    // Valor: pode ser coluna única (com sinal) ou separado em débito/crédito
    let rawAmount = 0;
    let signedAmt: number | undefined;

    if (colDebit >= 0 || colCredit >= 0) {
      const debit  = parseAmount(cols[colDebit]  ?? '0') || 0;
      const credit = parseAmount(cols[colCredit] ?? '0') || 0;
      if (debit > 0)  { rawAmount = debit;  signedAmt = -debit; }
      if (credit > 0) { rawAmount = credit; signedAmt = credit; }
    } else if (colAmt >= 0) {
      const raw = cols[colAmt] ?? '';
      const parsed = parseSignedAmount(raw);
      rawAmount = Math.abs(parsed);
      signedAmt = parsed;
    } else {
      continue;
    }

    if (!rawAmount) continue;

    const merchant = colMerch >= 0 ? cols[colMerch] : undefined;
    const typeHint = colType >= 0 ? cols[colType] : '';

    results.push({
      raw_date:        parseDate(rawDate),
      raw_amount:      rawAmount,
      raw_description: rawDesc || 'Transação importada',
      raw_type:        inferType(typeHint || rawDesc, rawAmount, signedAmt),
      merchant:        merchant || undefined,
      selected: true,
    });
  }

  return results;
}

// ─── PART 4 — PDF Parser local fallback ──────────────────────────────────────

export async function parsePDF(file: File): Promise<ImportedTransaction[]> {
  try {
    const text = await file.text();
    const parsed = parsePdfStatementText(text);

    return parsed.map(row => ({
      raw_date: parseDate(row.date),
      raw_amount: parseAmount(row.amount),
      raw_description: row.description,
      raw_type: inferType(row.description, row.amount),
      merchant: row.merchant || undefined,
      selected: true,
      category: (Object.values(Category) as string[]).includes(row.category)
        ? (row.category as Category)
        : undefined,
    }));
  } catch {
    return [];
  }
}

// ─── PART 6 — AI Classification via backend ─────────────────────────────────

export async function classifyImportedTransactions(
  transactions: ImportedTransaction[],
  userId: string
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
        learnMemory(userId, key, category, r.confidence ?? 0.7).catch(e => {
          console.error('importService learnMemory error:', e);
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
  } catch {
    return transactions.map(item => ({
      ...item,
      category: item.category ?? Category.PESSOAL,
      confidence: item.confidence ?? 0.3,
      type: item.type ?? item.raw_type,
    }));
  }
}

// ─── Main import pipeline ─────────────────────────────────────────────────────

export async function detectFormat(file: File): Promise<ImportFormat> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx';
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) return 'csv';
  if (name.endsWith('.pdf')) return 'pdf';

  // Tentar detectar pelo conteúdo
  try {
    const head = await file.slice(0, 200).text();
    if (head.includes('OFXHEADER') || head.includes('<OFX>')) return 'ofx';
    if (head.startsWith('%PDF')) return 'pdf';
  } catch { /* silencioso */ }

  return 'unknown';
}

export async function runImportPipeline(
  file: File,
  existingTransactions: Transaction[],
  userId: string,
  onProgress?: (step: string, pct: number) => void
): Promise<ImportResult> {
  const start = Date.now();
  const errors: string[] = [];
  let transactions: ImportedTransaction[] = [];

  onProgress?.('Detectando formato…', 5);
  const format = await detectFormat(file);

  try {
    // ── Parse ──────────────────────────────────────────────────────────────

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
      // Tentar como CSV por default
      onProgress?.('Formato desconhecido — tentando CSV…', 20);
      const content = await file.text();
      transactions = parseCSV(content);
      if (transactions.length === 0) {
        errors.push('Formato não reconhecido. Tente OFX, CSV ou PDF.');
      }
    }

    if (transactions.length === 0) {
      errors.push('Nenhuma transação encontrada no arquivo.');
    }

    // ── Duplicate detection ────────────────────────────────────────────────
    onProgress?.('Verificando duplicatas…', 50);
    transactions = markDuplicates(transactions, existingTransactions);

    // ── AI Classification ─────────────────────────────────────────────────
    if (transactions.length > 0) {
      onProgress?.('Classificando com IA…', 65);
      transactions = await classifyImportedTransactions(transactions, userId);
    }

  } catch (err: any) {
    errors.push(err?.message ?? 'Erro ao processar arquivo.');
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

// ─── Convert to Transaction[] for saving ─────────────────────────────────────

export function toTransactions(
  items: ImportedTransaction[],
  accountId?: string
): Partial<Transaction>[] {
  return items
    .filter(item => item.selected && !item.duplicate)
    .map(item => {
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
