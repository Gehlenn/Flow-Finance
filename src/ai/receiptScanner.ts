/**
 * RECEIPT SCANNER
 *
 * Delega a extração de recibos/notas fiscais ao backend.
 * NENHUMA chave de API é usada aqui — tudo via proxy seguro.
 */

import { TransactionType, Category } from '../../types';
import { apiRequest, API_ENDPOINTS } from '../config/api.config';

// ─── Model ────────────────────────────────────────────────────────────────────

export interface ScannedReceipt {
  amount: number | null;
  merchant: string | null;
  date: string | null;          // ISO string
  description: string | null;
  category: Category | null;
  type: TransactionType | null;
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'transfer' | null;
  raw_text?: string;            // opcional: não garantido pelo contrato backend
  confidence: number;           // 0–1
}

export interface ScanResult {
  success: boolean;
  data: ScannedReceipt | null;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function normalizeCategory(raw: string): Category {
  const map: Record<string, Category> = {
    'pessoal':              Category.PESSOAL,
    'trabalho':             Category.CONSULTORIO,
    'consultório':          Category.CONSULTORIO,
    'consultorio':          Category.CONSULTORIO,
    'negócio':              Category.NEGOCIO,
    'negocio':              Category.NEGOCIO,
    'investimento':         Category.INVESTIMENTO,
  };
  const key = raw.toLowerCase().trim();
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k)) return v;
  }
  return Category.PESSOAL;
}

function normalizeType(raw: string): TransactionType {
  if (raw.toLowerCase().includes('receita') || raw.toLowerCase().includes('recebimento')) {
    return TransactionType.RECEITA;
  }
  return TransactionType.DESPESA;
}

// ─── PART 4 — Core scanner functions ──────────────────────────────────────────

/**
 * Extrai texto OCR enviando a imagem ao backend (Gemini Vision roda no servidor).
 * Retorna o texto bruto extraído ou string vazia em caso de falha.
 */
export async function extractTextFromImage(image: File): Promise<string> {
  try {
    const result = await scanReceipt(image);
    if (!result.success || !result.data) return '';

    const parts = [
      result.data.description,
      result.data.amount != null ? String(result.data.amount) : null,
      result.data.date,
    ].filter(Boolean);
    return parts.join(' ').trim();
  } catch {
    return '';
  }
}

// ─── PART 3 — Confidence breakdown ───────────────────────────────────────────

export interface ConfidenceBreakdown {
  amount:   number;   // 0–1
  merchant: number;
  date:     number;
  overall:  number;
}

/** Per-field confidence + weighted overall score */
export function calculateConfidence(receipt: Partial<ScannedReceipt>): ConfidenceBreakdown {
  let amountConf = 0;
  if (receipt.amount != null && receipt.amount > 0) {
    amountConf = 0.6;
    if (receipt.amount < 50000) amountConf += 0.2;
    if (receipt.amount !== Math.round(receipt.amount)) amountConf += 0.2; // has cents
  }

  let merchantConf = 0;
  if (receipt.merchant) {
    merchantConf = 0.4;
    if (receipt.merchant.length > 4) merchantConf += 0.3;
    if (/[a-z]/.test(receipt.merchant)) merchantConf += 0.3; // mixed case = real name
  }

  let dateConf = 0;
  if (receipt.date) {
    const d = new Date(receipt.date);
    if (!isNaN(d.getTime())) {
      dateConf = 0.5;
      const twoYearsAgo = Date.now() - 2 * 365 * 86400000;
      if (d.getTime() > twoYearsAgo && d.getTime() <= Date.now()) dateConf = 1.0;
    }
  }

  const overall = amountConf * 0.5 + merchantConf * 0.3 + dateConf * 0.2;
  return {
    amount:   Math.min(1, amountConf),
    merchant: Math.min(1, merchantConf),
    date:     Math.min(1, dateConf),
    overall:  Math.min(1, overall),
  };
}

/** Parseia texto OCR e retorna dados estruturados — ENHANCED (PART 3) */
export function parseReceiptText(text: string): Partial<ScannedReceipt> {
  const result: Partial<ScannedReceipt> = { raw_text: text, confidence: 0 };

  // ── AMOUNT — priority ladder ───────────────────────────────────────────────
  const amountStrategies: Array<[RegExp, boolean]> = [
    [/TOTAL\s+A\s+PAGAR[:\s]*R?\$?\s*([\d.]+,\d{2})/i,  true],
    [/VALOR\s+TOTAL[:\s]*R?\$?\s*([\d.]+,\d{2})/i,       true],
    [/TOTAL[:\s]+R?\$?\s*([\d.]+,\d{2})/i,               true],
    [/GRAND\s+TOTAL[:\s]*R?\$?\s*([\d.]+,\d{2})/i,       true],
    [/R\$\s*([\d.]+,\d{2})/i,                             true],
    [/VALOR[:\s]*R?\$?\s*([\d.]+,\d{2})/i,               true],
    [/([\d]{1,3}(?:\.\d{3})*,\d{2})/,                    true],   // BR format
    [/(\d+\.\d{2})\b/,                                    false],  // US format
  ];
  for (const [pattern, isBR] of amountStrategies) {
    const match = text.match(pattern);
    if (match) {
      const raw = isBR
        ? match[1].replace(/\./g, '').replace(',', '.')
        : match[1];
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0.01) { result.amount = val; break; }
    }
  }

  // ── DATE — multi-format strategies ────────────────────────────────────────
  const dateStrategies: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/, m => `${m[3]}-${m[2]}-${m[1]}`],
    [/\b(\d{4})-(\d{2})-(\d{2})\b/,            m => `${m[1]}-${m[2]}-${m[3]}`],
    [/(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
      m => {
        const months: Record<string, string> = {
          janeiro:'01',fevereiro:'02',marco:'03',março:'03',abril:'04',maio:'05',junho:'06',
          julho:'07',agosto:'08',setembro:'09',outubro:'10',novembro:'11',dezembro:'12',
        };
        const key = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        return `${m[3]}-${months[key] ?? '01'}-${m[1].padStart(2,'0')}`;
      }
    ],
  ];
  for (const [pattern, builder] of dateStrategies) {
    const match = text.match(pattern);
    if (match) {
      try {
        const d = new Date(builder(match));
        if (!isNaN(d.getTime())) { result.date = d.toISOString(); break; }
      } catch { /* try next */ }
    }
  }

  // ── MERCHANT — ranked extraction ──────────────────────────────────────────
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  // Strategy 1: known brand detection
  const KNOWN_BRANDS = [
    'McDonald','Burger King','Subway','KFC','iFood','Rappi','Uber','99',
    'Amazon','Mercado Livre','Shopee','Magazine Luiza',
    'Pão de Açúcar','Carrefour','Extra','Atacadão',
    'Droga Raia','Drogasil','Farmácia',
    'Netflix','Spotify','Apple','Google','Microsoft',
    'Petrobras','Shell','Ipiranga','Smart Fit',
  ];
  const brandLine = lines.find(l =>
    KNOWN_BRANDS.some(b => l.toLowerCase().includes(b.toLowerCase()))
  );
  if (brandLine) result.merchant = brandLine.slice(0, 60).trim();

  // Strategy 2: first non-noise substantial line
  if (!result.merchant) {
    const noise = /^\d|^R\$|^CNPJ|^CPF|^CEP|^Tel|^End|^Rua|^Av\.|^Data|^\*/i;
    result.merchant = lines.find(l => !noise.test(l) && l.length >= 4 && l.length <= 60);
  }

  // Strategy 3: line following a label
  if (!result.merchant) {
    const idx = lines.findIndex(l => /estabelecimento|loja|fornecedor|empresa/i.test(l));
    if (idx >= 0 && lines[idx + 1]) result.merchant = lines[idx + 1].slice(0, 60);
  }

  // ── CONFIDENCE — weighted scoring ─────────────────────────────────────────
  result.confidence = calculateConfidence(result).overall;

  return result;
}

/**
 * Escaneia recibo enviando ao backend (Gemini Vision roda no servidor).
 * NENHUMA chave de API no frontend.
 */
export async function scanReceipt(image: File): Promise<ScanResult> {
  try {
    const { base64, mimeType } = await fileToBase64(image);
    const raw = await apiRequest<Record<string, unknown>>(
      API_ENDPOINTS.AI.SCAN_RECEIPT,
      {
        method: 'POST',
        body: JSON.stringify({ imageBase64: base64, imageMimeType: mimeType }),
      },
    );

    const data: ScannedReceipt = {
      amount:         typeof raw.amount === 'number' ? raw.amount : null,
      merchant:       null,
      date:           raw.date ? new Date(raw.date as string).toISOString() : null,
      description:    (raw.description as string) ?? null,
      category:       raw.category ? normalizeCategory(raw.category as string) : null,
      type:           raw.type ? normalizeType(raw.type as string) : TransactionType.DESPESA,
      payment_method: null,
      raw_text:       typeof raw.raw_text === 'string' ? raw.raw_text : undefined,
      confidence:     calculateConfidence({
        amount: typeof raw.amount === 'number' ? raw.amount : null,
        merchant: null,
        date: raw.date ? String(raw.date) : null,
      }).overall,
    };

    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Erro ao escanear recibo',
    };
  }
}
