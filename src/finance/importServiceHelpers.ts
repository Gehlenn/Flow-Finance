import { Category, TransactionType, type Transaction } from '../../types';
import { parsePdfStatementText } from '../importers/pdfStatementImporter';
import type { ImportFormat, ImportedTransaction } from './importService';

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString();

  const cleaned = raw.trim();
  const toLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateOnly = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month
      && localDate.getDate() === day
    ) {
      return toLocalDateKey(localDate);
    }
  }

  const ofxMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    const year = Number(ofxMatch[1]);
    const month = Number(ofxMatch[2]) - 1;
    const day = Number(ofxMatch[3]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month
      && localDate.getDate() === day
    ) {
      return toLocalDateKey(localDate);
    }
  }

  const brMatch = cleaned.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
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
      return toLocalDateKey(localDate);
    }
  }

  const usMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (usMatch) {
    const year = Number(usMatch[3]);
    const month = Number(usMatch[1]) - 1;
    const day = Number(usMatch[2]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month
      && localDate.getDate() === day
    ) {
      return toLocalDateKey(localDate);
    }
  }

  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseAmount(raw: string | number): number {
  if (typeof raw === 'number') return Math.abs(raw);
  const s = String(raw).replace(/[R$\s]/g, '');
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

function inferType(raw: string, amount: number, signedAmount?: number): TransactionType {
  if (signedAmount !== undefined && signedAmount < 0) return TransactionType.DESPESA;
  if (signedAmount !== undefined && signedAmount > 0) return TransactionType.RECEITA;

  const lower = raw.toLowerCase();
  const incomeKw = ['salário', 'salario', 'receita', 'crédito', 'credito', 'pix recebido',
    'transferência recebida', 'deposito', 'depósito', 'rendimento', 'juros'];
  if (incomeKw.some((kw) => lower.includes(kw))) return TransactionType.RECEITA;
  return TransactionType.DESPESA;
}

function markDuplicates(
  imported: ImportedTransaction[],
  existing: Transaction[],
): ImportedTransaction[] {
  const parseComparableDate = (dateValue: string): number | null => {
    const trimmed = dateValue.trim();
    const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsed = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };

  return imported.map((item) => {
    const dup = existing.some((ex) => {
      const existingDate = parseComparableDate(ex.date);
      const importedDate = parseComparableDate(item.raw_date);
      const sameDate = existingDate !== null && importedDate !== null
        ? Math.abs(existingDate - importedDate) < 86400000 * 2
        : false;
      const sameAmt = Math.abs(ex.amount - item.raw_amount) < 0.01;
      const sameDesc = ex.description.toLowerCase().includes(item.raw_description.toLowerCase().slice(0, 8));
      return sameDate && sameAmt && sameDesc;
    });
    return { ...item, duplicate: dup };
  });
}

type OFXTransactionState = Partial<ImportedTransaction> & {
  _date?: string;
  _amt?: string;
  _memo?: string;
  _name?: string;
};

export function parseOFX(content: string): ImportedTransaction[] {
  const results: ImportedTransaction[] = [];
  const trimmed = content.trimStart();
  const isXml = trimmed.startsWith('<?xml') || /<\/(DTPOSTED|DTUSER|TRNAMT|MEMO|NAME|AMOUNT)>/i.test(content);

  if (isXml) {
    const txBlocks = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) ?? [];
    for (const block of txBlocks) {
      const get = (tag: string) =>
        block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`, 'i'))?.[1]?.trim() ?? '';

      const rawAmt = get('TRNAMT') || get('AMOUNT');
      const signedAmt = parseFloat(rawAmt.replace(',', '.'));
      const amount = Math.abs(signedAmt);
      if (!amount) continue;

      results.push({
        raw_date: parseDate(get('DTPOSTED') || get('DTUSER')),
        raw_amount: amount,
        raw_description: get('MEMO') || get('NAME') || get('TRNTYPE'),
        raw_type: signedAmt < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
        selected: true,
      });
    }
  } else {
    const lines = content.split(/\r?\n/).map((line) => line.trim());
    let currentTx: OFXTransactionState = {};
    let inTx = false;

    for (const line of lines) {
      if (line === '<STMTTRN>') { inTx = true; currentTx = {}; continue; }
      if (line === '</STMTTRN>' && inTx) {
        const rawAmt = currentTx._amt ?? '0';
        const signedAmt = parseSignedAmount(rawAmt);
        const amount = Math.abs(signedAmt);
        if (amount > 0) {
          results.push({
            raw_date: parseDate(currentTx._date ?? ''),
            raw_amount: amount,
            raw_description: ((currentTx._memo || currentTx._name || 'Transação importada').trim()),
            raw_type: signedAmt < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
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
      if (tagUpper === 'DTPOSTED' || tagUpper === 'DTUSER') currentTx._date = value;
      else if (tagUpper === 'TRNAMT') currentTx._amt = value;
      else if (tagUpper === 'MEMO') currentTx._memo = value;
      else if (tagUpper === 'NAME') currentTx._name = value;
    }
  }

  return results;
}

export function parseCSV(content: string): ImportedTransaction[] {
  const results: ImportedTransaction[] = [];
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return results;

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

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
  const findCol = (...candidates: string[]) =>
    candidates.reduce((found, c) => found >= 0 ? found : headers.findIndex((h) => h.includes(c)), -1);

  const colDate = findCol('data', 'date', 'dt');
  const colDesc = findCol('descricao', 'descri', 'historico', 'memo', 'description', 'estabelecimento', 'lancamento');
  const colAmt = findCol('valor', 'amount', 'value', 'quantia');
  const colDebit = findCol('debito', 'saida', 'debit', 'despesa');
  const colCredit = findCol('credito', 'entrada', 'credit', 'receita');
  const colType = findCol('tipo', 'type', 'natureza');
  const colMerch = findCol('estabeleci', 'merchant', 'loja', 'empresa');

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 2) continue;

    const rawDate = colDate >= 0 ? cols[colDate] : '';
    const rawDesc = colDesc >= 0 ? cols[colDesc] : cols[1] ?? '';

    let rawAmount = 0;
    let signedAmt: number | undefined;

    if (colDebit >= 0 || colCredit >= 0) {
      const debit = parseAmount(cols[colDebit] ?? '0') || 0;
      const credit = parseAmount(cols[colCredit] ?? '0') || 0;
      if (debit > 0) { rawAmount = debit; signedAmt = -debit; }
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
      raw_date: parseDate(rawDate),
      raw_amount: rawAmount,
      raw_description: rawDesc || 'Transação importada',
      raw_type: inferType(typeHint || rawDesc, rawAmount, signedAmt),
      merchant: merchant || undefined,
      selected: true,
    });
  }

  return results;
}

export async function parsePDF(file: File): Promise<ImportedTransaction[]> {
  try {
    const text = await file.text();
    const parsed = parsePdfStatementText(text);

    return parsed.map((row) => ({
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

export function markImportedDuplicates(
  imported: ImportedTransaction[],
  existing: Transaction[],
): ImportedTransaction[] {
  return markDuplicates(imported, existing);
}
