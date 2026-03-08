/**
 * OFX PARSER — src/services/finance/ofxParser.ts
 *
 * Parseia extratos bancários no formato OFX (Open Financial Exchange).
 * Suporta SGML OFX clássico (linha a linha) e OFX XML.
 *
 * Retorna Transaction[] pronto para uso direto na aplicação.
 */

import { Transaction, TransactionType, Category } from '../../types';

// ─── Helpers internos ─────────────────────────────────────────────────────────

function makeId(): string {
  return `ofx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseOFXDate(raw: string): string {
  // OFX: YYYYMMDD or YYYYMMDDHHMMSS[.mmm][±hh:mm]
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`).toISOString();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseOFXAmount(raw: string): number {
  return Math.abs(parseFloat(raw.replace(',', '.')) || 0);
}

function inferType(signedAmount: number): TransactionType {
  return signedAmount < 0 ? TransactionType.DESPESA : TransactionType.RECEITA;
}

/** Extrai texto dentro de <TAG>valor</TAG> ou <TAG>valor (SGML sem fechamento) */
function getTag(block: string, tag: string): string {
  // XML style: <TAG>value</TAG>
  const xmlMatch = block.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'));
  if (xmlMatch) return xmlMatch[1].trim();
  // SGML style: <TAG>value\n
  const sgmlMatch = block.match(new RegExp(`<${tag}>([^\r\n<]*)`, 'i'));
  return sgmlMatch ? sgmlMatch[1].trim() : '';
}

// ─── PART 1 — parseOFX ────────────────────────────────────────────────────────

/**
 * Parseia conteúdo OFX/QFX e retorna array de transações.
 *
 * @param fileContent - string do arquivo OFX
 * @returns Transaction[]
 */
export function parseOFX(fileContent: string): Transaction[] {
  const results: Transaction[] = [];

  // Normalizar quebras de linha
  const content = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ── XML OFX ──────────────────────────────────────────────────────────────
  const isXml =
    content.trimStart().startsWith('<?xml') ||
    /<OFX>/i.test(content) ||
    /<stmttrn>/i.test(content);

  if (isXml) {
    const blocks = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) ?? [];
    for (const block of blocks) {
      const rawAmt = getTag(block, 'TRNAMT') || getTag(block, 'AMOUNT');
      const signedAmt = parseFloat(rawAmt.replace(',', '.'));
      if (!signedAmt) continue;

      const dateRaw = getTag(block, 'DTPOSTED') || getTag(block, 'DTUSER');
      const desc = getTag(block, 'MEMO') || getTag(block, 'NAME') || getTag(block, 'TRNTYPE') || 'Transação OFX';

      results.push({
        id:          makeId(),
        amount:      parseOFXAmount(rawAmt),
        type:        inferType(signedAmt),
        category:    Category.PESSOAL,
        description: desc,
        date:        parseOFXDate(dateRaw),
        merchant:    getTag(block, 'NAME') || undefined,
        source:      'import',
        confidence_score: 0.85,
      } as Transaction);
    }
    return results;
  }

  // ── SGML OFX (linha a linha) ──────────────────────────────────────────────
  const lines = content.split('\n').map(l => l.trim());
  let inTx = false;
  let tx: Record<string, string> = {};

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper === '<STMTTRN>') {
      inTx = true;
      tx = {};
      continue;
    }

    if (upper === '</STMTTRN>') {
      if (inTx && tx['TRNAMT']) {
        const signedAmt = parseFloat(tx['TRNAMT'].replace(',', '.'));
        const amount = Math.abs(signedAmt);
        if (amount > 0) {
          const desc = tx['MEMO'] || tx['NAME'] || 'Transação OFX';
          results.push({
            id:          makeId(),
            amount,
            type:        inferType(signedAmt),
            category:    Category.PESSOAL,
            description: desc,
            date:        parseOFXDate(tx['DTPOSTED'] || tx['DTUSER'] || ''),
            merchant:    tx['NAME'] || undefined,
            source:      'import',
            confidence_score: 0.85,
          } as Transaction);
        }
      }
      inTx = false;
      tx = {};
      continue;
    }

    if (!inTx) continue;

    // <TAGNAME>value
    const match = line.match(/^<([A-Z0-9]+)>(.*)$/i);
    if (match) {
      tx[match[1].toUpperCase()] = match[2].trim();
    }
  }

  return results;
}

// ─── Helpers re-exportados ────────────────────────────────────────────────────

/** Detecta se uma string é provável OFX */
export function isOFXContent(content: string): boolean {
  return /OFXHEADER|<OFX>|<STMTTRN>/i.test(content.slice(0, 1000));
}

/** Retorna resumo de um array de transações OFX */
export function summarizeOFXParse(txs: Transaction[]): {
  total: number;
  income: number;
  expenses: number;
  earliest: string | null;
  latest: string | null;
} {
  if (txs.length === 0) return { total: 0, income: 0, expenses: 0, earliest: null, latest: null };
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  return {
    total:    txs.length,
    income:   txs.filter(t => t.type === TransactionType.RECEITA).reduce((s, t) => s + t.amount, 0),
    expenses: txs.filter(t => t.type === TransactionType.DESPESA).reduce((s, t) => s + t.amount, 0),
    earliest: sorted[0]?.date ?? null,
    latest:   sorted[sorted.length - 1]?.date ?? null,
  };
}
