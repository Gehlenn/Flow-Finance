/**
 * CSV PARSER — src/services/finance/csvParser.ts
 *
 * Parseia extratos bancários em formato CSV com detecção automática de:
 *   - Separador (, ; \t |)
 *   - Colunas (data, descrição, valor, débito/crédito separados)
 *   - Formato de data (BR DD/MM/YYYY, ISO YYYY-MM-DD, US MM/DD/YYYY)
 *   - Formato de valor (BR 1.234,56 e US 1,234.56)
 *
 * Retorna Transaction[] pronto para uso direto na aplicação.
 */

import { Transaction, TransactionType, Category } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(): string {
  return `csv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Detecta separador dominante na linha de cabeçalho */
function detectSeparator(header: string): string {
  const counts = {
    ';': (header.match(/;/g) ?? []).length,
    ',': (header.match(/,/g) ?? []).length,
    '\t': (header.match(/\t/g) ?? []).length,
    '|': (header.match(/\|/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Divide linha respeitando aspas */
function splitLine(line: string, sep: string): string[] {
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
}

/** Normaliza cabeçalho para detecção de colunas */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Encontra índice de coluna por lista de candidatos */
function findCol(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const c of candidates) {
    const i = normalized.findIndex(h => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

/** Parseia data em múltiplos formatos → ISO string */
function parseDate(raw: string): string {
  const s = raw.trim();
  if (!s) return new Date().toISOString();

  // DD/MM/YYYY or DD-MM-YYYY
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (br) {
    const d = new Date(`${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // YYYY-MM-DD (ISO)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // MM/DD/YYYY (US)
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
}

/** Parseia valor monetário (BR e US) → número positivo */
function parseAmount(raw: string): number {
  if (!raw?.trim()) return 0;
  const s = raw.trim().replace(/[R$\s\u00a0]/g, '');
  // Formato BR: 1.234,56
  if (/^\d{1,3}(\.\d{3})*(,\d{2})?$/.test(s)) {
    return Math.abs(parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0);
  }
  // Formato com vírgula decimal: 1234,56
  if (/^-?\d+,\d{1,2}$/.test(s)) {
    return Math.abs(parseFloat(s.replace(',', '.')) || 0);
  }
  // Formato US ou padrão: 1234.56
  return Math.abs(parseFloat(s.replace(/,/g, '')) || 0);
}

/** Infere tipo pela descrição ou sinal */
function inferType(desc: string, signed?: number): TransactionType {
  if (signed !== undefined) {
    return signed < 0 ? TransactionType.DESPESA : TransactionType.RECEITA;
  }
  const lower = desc.toLowerCase();
  const incomeKw = ['salário', 'salario', 'receita', 'crédito', 'credito',
    'pix recebido', 'transferência recebida', 'deposito', 'depósito',
    'rendimento', 'juros', 'freelance', 'pagamento recebido'];
  if (incomeKw.some(kw => lower.includes(kw))) return TransactionType.RECEITA;
  return TransactionType.DESPESA;
}

// ─── PART 2 — parseCSV ────────────────────────────────────────────────────────

/**
 * Parseia conteúdo CSV de extrato bancário e retorna array de transações.
 *
 * @param fileContent - string do arquivo CSV/TSV
 * @returns Transaction[]
 */
export function parseCSV(fileContent: string): Transaction[] {
  const results: Transaction[] = [];

  // Normalizar quebras de linha e dividir em linhas
  const rawLines = fileContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (rawLines.length < 2) return results;

  // Pular linhas de metadados do banco (ex: "Banco Itaú SA", "Conta: 12345-6")
  // Encontrar a linha de cabeçalho real (que contém palavras como "data", "valor", "descrição")
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const lower = rawLines[i].toLowerCase();
    if (/data|date|valor|amount|descri|histo|lanca/.test(lower)) {
      headerIdx = i;
      break;
    }
  }

  const headerLine = rawLines[headerIdx];
  const sep = detectSeparator(headerLine);
  const headers = splitLine(headerLine, sep);

  // Detectar colunas
  const colDate   = findCol(headers, 'data', 'date', 'dt', 'vencimento', 'competencia');
  const colDesc   = findCol(headers, 'descri', 'historico', 'lancamento', 'memo', 'estabeleci', 'description');
  const colAmt    = findCol(headers, 'valor', 'amount', 'value', 'quantia', 'montante');
  const colDebit  = findCol(headers, 'debito', 'saida', 'debit', 'despesa', 'out');
  const colCredit = findCol(headers, 'credito', 'entrada', 'credit', 'receita', 'in');
  const colType   = findCol(headers, 'tipo', 'type', 'natureza', 'dc', 'db');
  const colMerch  = findCol(headers, 'estabeleci', 'merchant', 'loja', 'empresa', 'favorecido');
  const colBalance= findCol(headers, 'saldo', 'balance');

  // Processar linhas de dados
  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line.trim()) continue;

    const cols = splitLine(line, sep);
    if (cols.length < 2) continue;

    // Detectar e pular linhas de totais/sumário
    const firstCol = (cols[0] ?? '').toLowerCase();
    if (/total|saldo|subtotal|resumo/.test(firstCol)) continue;

    // Data
    const rawDate = colDate >= 0 ? cols[colDate] ?? '' : '';

    // Descrição
    const rawDesc = colDesc >= 0
      ? cols[colDesc] ?? ''
      : cols.find(c => c.length > 3 && !/^\d/.test(c)) ?? '';

    // Valor
    let amount = 0;
    let signedAmt: number | undefined;

    if (colDebit >= 0 || colCredit >= 0) {
      // Colunas separadas de débito e crédito
      const debit  = parseAmount(cols[colDebit]  ?? '');
      const credit = parseAmount(cols[colCredit] ?? '');
      if (debit > 0)  { amount = debit;  signedAmt = -debit; }
      if (credit > 0) { amount = credit; signedAmt = credit; }
    } else if (colAmt >= 0) {
      const raw = cols[colAmt] ?? '';
      const raw2 = raw.replace(/[R$\s]/g, '');
      const parsed = parseFloat(raw2.replace(/\./g, '').replace(',', '.'));
      amount = Math.abs(isNaN(parsed) ? 0 : parsed);
      signedAmt = isNaN(parsed) ? undefined : parsed;
    } else {
      // Fallback: procurar coluna com número
      for (const col of cols) {
        const v = parseAmount(col);
        if (v > 0) { amount = v; break; }
      }
    }

    if (!amount) continue;

    // Tipo
    let type = inferType(rawDesc, signedAmt);
    if (colType >= 0) {
      const t = (cols[colType] ?? '').toLowerCase();
      if (/d|deb|saida|despesa/.test(t)) type = TransactionType.DESPESA;
      if (/c|cred|entrada|receita/.test(t)) type = TransactionType.RECEITA;
    }

    const merchant = colMerch >= 0 ? cols[colMerch] || undefined : undefined;

    results.push({
      id:          makeId(),
      amount,
      type,
      category:    Category.PESSOAL,
      description: rawDesc || 'Transação CSV',
      date:        parseDate(rawDate),
      merchant:    merchant || undefined,
      source:      'import',
      confidence_score: 0.75,
    } as Transaction);
  }

  return results;
}

// ─── Helpers re-exportados ────────────────────────────────────────────────────

/** Detecta se um conteúdo parece ser CSV financeiro */
export function isCSVContent(content: string): boolean {
  const firstLines = content.split('\n').slice(0, 5).join('\n').toLowerCase();
  return /data|valor|descri|amount|date/.test(firstLines);
}

/** Retorna detecção de colunas para debug */
export function detectCSVColumns(fileContent: string): Record<string, number> {
  const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 1) return {};
  const sep = detectSeparator(lines[0]);
  const headers = splitLine(lines[0], sep);
  return {
    date:   findCol(headers, 'data', 'date'),
    desc:   findCol(headers, 'descri', 'historico'),
    amount: findCol(headers, 'valor', 'amount'),
    debit:  findCol(headers, 'debito', 'saida'),
    credit: findCol(headers, 'credito', 'entrada'),
  };
}

/** Retorna resumo de parse */
export function summarizeCSVParse(txs: Transaction[]): {
  total: number;
  income: number;
  expenses: number;
} {
  return {
    total:    txs.length,
    income:   txs.filter(t => t.type === TransactionType.RECEITA).reduce((s, t) => s + t.amount, 0),
    expenses: txs.filter(t => t.type === TransactionType.DESPESA).reduce((s, t) => s + t.amount, 0),
  };
}
