/**
 * RECEIPT SCANNER
 *
 * Delegates receipt extraction to the backend.
 * No API keys are used in the frontend.
 */

import { Category, TransactionType } from '../../types';
import { apiRequest, API_ENDPOINTS } from '../config/api.config';
import { logWarn } from '../utils/logger';
import {
  formatLocalDateKey,
  normalizeCategory,
  normalizeType,
  parseReceiptDate,
} from './receiptScannerHelpers';

export interface ScannedReceipt {
  amount: number | null;
  merchant: string | null;
  date: string | null;
  description: string | null;
  category: Category | null;
  type: TransactionType | null;
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'transfer' | null;
  raw_text?: string;
  confidence: number;
}

export interface ScanResult {
  success: boolean;
  data: ScannedReceipt | null;
  error?: string;
}

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

export interface ConfidenceBreakdown {
  amount: number;
  merchant: number;
  date: number;
  overall: number;
}

export function calculateConfidence(receipt: Partial<ScannedReceipt>): ConfidenceBreakdown {
  let amountConf = 0;
  if (receipt.amount != null && receipt.amount > 0) {
    amountConf = 0.6;
    if (receipt.amount < 50000) amountConf += 0.2;
    if (receipt.amount !== Math.round(receipt.amount)) amountConf += 0.2;
  }

  let merchantConf = 0;
  if (receipt.merchant) {
    merchantConf = 0.4;
    if (receipt.merchant.length > 4) merchantConf += 0.3;
    if (/[a-z]/.test(receipt.merchant)) merchantConf += 0.3;
  }

  let dateConf = 0;
  if (receipt.date) {
    const parsedDate = parseReceiptDate(receipt.date);
    if (parsedDate) {
      dateConf = 0.5;
      const twoYearsAgo = Date.now() - 2 * 365 * 86400000;
      if (parsedDate.getTime() > twoYearsAgo && parsedDate.getTime() <= Date.now()) {
        dateConf = 1.0;
      }
    }
  }

  const overall = amountConf * 0.5 + merchantConf * 0.3 + dateConf * 0.2;
  return {
    amount: Math.min(1, amountConf),
    merchant: Math.min(1, merchantConf),
    date: Math.min(1, dateConf),
    overall: Math.min(1, overall),
  };
}

function parseMonthNameDate(text: string): string | null {
  const match = text.match(
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
  );
  if (!match) {
    return null;
  }

  const months: Record<string, string> = {
    janeiro: '01',
    fevereiro: '02',
    marco: '03',
    março: '03',
    abril: '04',
    maio: '05',
    junho: '06',
    julho: '07',
    agosto: '08',
    setembro: '09',
    outubro: '10',
    novembro: '11',
    dezembro: '12',
  };

  const key = match[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `${match[3]}-${months[key] ?? '01'}-${match[1].padStart(2, '0')}`;
}

function safeNormalizeLookup(value: string): string {
  try {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return value.toLowerCase();
  }
}

export function parseReceiptText(text: string): Partial<ScannedReceipt> {
  const result: Partial<ScannedReceipt> = { raw_text: text, confidence: 0 };

  const amountStrategies: Array<[RegExp, boolean]> = [
    [/TOTAL\s+A\s+PAGAR[:\s]*R?\$?\s*([\d.]+,\d{2})/i, true],
    [/VALOR\s+TOTAL[:\s]*R?\$?\s*([\d.]+,\d{2})/i, true],
    [/TOTAL[:\s]+R?\$?\s*([\d.]+,\d{2})/i, true],
    [/GRAND\s+TOTAL[:\s]*R?\$?\s*([\d.]+,\d{2})/i, true],
    [/R\$\s*([\d.]+,\d{2})/i, true],
    [/VALOR[:\s]*R?\$?\s*([\d.]+,\d{2})/i, true],
    [/([\d]{1,3}(?:\.\d{3})*,\d{2})/, true],
    [/(\d+\.\d{2})\b/, false],
  ];

  for (const [pattern, isBR] of amountStrategies) {
    const match = text.match(pattern);
    if (!match) continue;

    const raw = isBR ? match[1].replace(/\./g, '').replace(',', '.') : match[1];
    const value = Number.parseFloat(raw);
    if (!Number.isNaN(value) && value > 0.01) {
      result.amount = value;
      break;
    }
  }

  const dateStrategies: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/, (m) => `${m[3]}-${m[2]}-${m[1]}`],
    [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
    [/(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i, () => {
      const parsed = parseMonthNameDate(text);
      if (!parsed) {
        throw new Error('Unable to parse month name date');
      }
      return parsed;
    }],
  ];

  for (const [pattern, builder] of dateStrategies) {
    const match = text.match(pattern);
    if (!match) continue;

    try {
      const parsedDate = parseReceiptDate(builder(match));
      if (parsedDate) {
        result.date = formatLocalDateKey(parsedDate);
        break;
      }
    } catch (error) {
      logWarn('[ReceiptScanner] Failed to parse receipt date strategy; trying next', {
        error,
        rawText: text.slice(0, 120),
      });
    }
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  const knownBrands = [
    'mcdonald',
    'burger king',
    'subway',
    'kfc',
    'ifood',
    'rappi',
    'uber',
    '99',
    'amazon',
    'mercado livre',
    'shopee',
    'magazine luiza',
    'pao de acucar',
    'carrefour',
    'extra',
    'atacadao',
    'droga raia',
    'drogasil',
    'farmacia',
    'netflix',
    'spotify',
    'apple',
    'google',
    'microsoft',
    'petrobras',
    'shell',
    'ipiranga',
    'smart fit',
  ];

  const brandLine = lines.find((line) => {
    const normalized = safeNormalizeLookup(line);
    return knownBrands.some((brand) => normalized.includes(brand));
  });
  if (brandLine) {
    result.merchant = brandLine.slice(0, 60).trim();
  }

  if (!result.merchant) {
    const noise = /^\d|^R\$|^CNPJ|^CPF|^CEP|^Tel|^End|^Rua|^Av\.|^Data|^\*/i;
    result.merchant = lines.find((line) => !noise.test(line) && line.length >= 4 && line.length <= 60);
  }

  if (!result.merchant) {
    const idx = lines.findIndex((line) => /estabelecimento|loja|fornecedor|empresa/i.test(line));
    if (idx >= 0 && lines[idx + 1]) {
      result.merchant = lines[idx + 1].slice(0, 60);
    }
  }

  result.confidence = calculateConfidence(result).overall;
  return result;
}

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
  } catch (error) {
    logWarn('[ReceiptScanner] Failed to extract text from image; returning empty text', {
      error,
      fileName: image.name,
    });
    return '';
  }
}

export async function scanReceipt(image: File): Promise<ScanResult> {
  try {
    const { base64, mimeType } = await fileToBase64(image);
    const raw = await apiRequest<Record<string, unknown>>(API_ENDPOINTS.AI.SCAN_RECEIPT, {
      method: 'POST',
      body: JSON.stringify({ imageBase64: base64, imageMimeType: mimeType }),
    });

    const rawDate = typeof raw.date === 'string' ? parseReceiptDate(raw.date) : null;
    const normalizedDate = rawDate ? formatLocalDateKey(rawDate) : null;

    const data: ScannedReceipt = {
      amount: typeof raw.amount === 'number' ? raw.amount : null,
      merchant: null,
      date: normalizedDate,
      description: (raw.description as string) ?? null,
      category: raw.category ? normalizeCategory(raw.category as string) : null,
      type: raw.type ? normalizeType(raw.type as string) : TransactionType.DESPESA,
      payment_method: null,
      raw_text: typeof raw.raw_text === 'string' ? raw.raw_text : undefined,
      confidence: calculateConfidence({
        amount: typeof raw.amount === 'number' ? raw.amount : null,
        merchant: null,
        date: normalizedDate,
      }).overall,
    };

    return { success: true, data };
  } catch (err: unknown) {
    logWarn('[ReceiptScanner] Failed to scan receipt; returning structured error', {
      error: err,
      fileName: image.name,
    });
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Erro ao escanear recibo',
    };
  }
}
