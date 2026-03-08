/**
 * RECEIPT SCANNER
 *
 * Usa Gemini Vision para extrair dados de recibos/notas fiscais.
 * Não depende de tesseract.js — o Gemini já tem OCR nativo de alta precisão.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Transaction, TransactionType, Category } from '../../types';

// ─── Model ────────────────────────────────────────────────────────────────────

export interface ScannedReceipt {
  amount: number | null;
  merchant: string | null;
  date: string | null;          // ISO string
  description: string | null;
  category: Category | null;
  type: TransactionType | null;
  payment_method: Transaction['payment_method'] | null;
  raw_text: string;             // texto bruto para debug
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

/** Extrai texto OCR + dados estruturados via Gemini Vision */
export async function extractTextFromImage(image: File): Promise<string> {
  const { base64, mimeType } = await fileToBase64(image);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        { inlineData: { data: base64, mimeType } },
        { text: 'Transcreva todo o texto visível neste documento financeiro (recibo, nota fiscal, boleto) exatamente como aparece. Mantenha valores, datas e nomes de estabelecimentos.' },
      ],
    },
  });

  return response.text ?? '';
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

/** Função principal: escaneia recibo e retorna dados estruturados via Gemini */
export async function scanReceipt(image: File): Promise<ScanResult> {
  try {
    const { base64, mimeType } = await fileToBase64(image);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

    const imagePart = { inlineData: { data: base64, mimeType } };
    const textPart = {
      text: `Você é um scanner OCR especializado em documentos financeiros brasileiros.
Analise esta imagem e extraia as informações exatas.

INSTRUÇÕES:
1. amount: valor TOTAL final em número decimal (ex: 47.90). Se houver múltiplos valores, use o TOTAL.
2. merchant: nome do estabelecimento ou favorecido (máx 50 chars)
3. date: data de emissão ou vencimento no formato ISO 8601 (YYYY-MM-DD)
4. description: breve descrição do serviço/produto (máx 80 chars)
5. category: uma de: "Pessoal", "Trabalho / Consultório", "Negócio", "Investimento"
6. type: "Despesa" para compras/pagamentos, "Receita" para recebimentos
7. payment_method: "cash", "credit_card", "debit_card", "pix" ou null se não identificado
8. confidence: sua confiança na extração de 0.0 a 1.0

Se não conseguir identificar algum campo, use null.`
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount:         { type: Type.NUMBER  },
            merchant:       { type: Type.STRING  },
            date:           { type: Type.STRING  },
            description:    { type: Type.STRING  },
            category:       { type: Type.STRING  },
            type:           { type: Type.STRING  },
            payment_method: { type: Type.STRING  },
            confidence:     { type: Type.NUMBER  },
          },
        },
      },
    });

    const raw = JSON.parse(response.text ?? '{}');

    const data: ScannedReceipt = {
      amount:         typeof raw.amount === 'number' ? raw.amount : null,
      merchant:       raw.merchant ?? null,
      date:           raw.date ? new Date(raw.date).toISOString() : null,
      description:    raw.description ?? null,
      category:       raw.category ? normalizeCategory(raw.category) : null,
      type:           raw.type ? normalizeType(raw.type) : TransactionType.DESPESA,
      payment_method: raw.payment_method ?? null,
      raw_text:       response.text ?? '',
      confidence:     typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    };

    return { success: true, data };
  } catch (err: any) {
    return { success: false, data: null, error: err?.message ?? 'Erro ao escanear recibo' };
  }
}
