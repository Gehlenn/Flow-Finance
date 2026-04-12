/**
 * INTAKE NORMALIZER — Conversor de origens para TransactionDraft
 *
 * Cada origem (manual, texto, scanner, arquivo, integração) passa por
 * um normalizador específico que produz o mesmo TransactionDraft.
 *
 * Nenhuma origem salva diretamente — tudo converge aqui primeiro.
 */

import { TransactionType, Category, TransactionData } from '../../types';
import {
  TransactionDraft,
  DraftSource,
  FieldConfidences,
  toConfidenceLevel,
  initialDraftStatus,
} from './transactionDraft';

// ─── Tipos de entrada por origem ─────────────────────────────────────────────

export interface ManualFormInput {
  description: string;
  amount: number | string;
  type: TransactionType;
  category?: Category;
  paymentMethod?: TransactionDraft['paymentMethod'];
  accountId?: string;
  recurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly';
  recurrenceInterval?: number;
}

export interface AITextOutput {
  data: TransactionData;
  confidence: number;
  rawInput: string;
  accountId?: string;
}

export interface AIImageOutput {
  data: TransactionData;
  confidence: number;
  mimeType?: string;
  accountId?: string;
}

export interface FileImportRow {
  amount: number;
  date: string;         // ISO string
  description: string;
  merchant?: string;
  type?: TransactionType;
  category?: Category;
  confidence?: number;
  source?: DraftSource;
}

export interface IntegrationPayload {
  externalReference: string;
  amount: number;
  currency?: string;
  occurredAt: string;
  description: string;
  type: TransactionType;
  category?: Category;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function parseAmount(raw: number | string): number {
  if (typeof raw === 'number') return Math.abs(raw);
  const clean = String(raw).replace(/[R$\s]/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.abs(n);
}

function safeIso(raw?: string): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ─── Normalizadores por origem ────────────────────────────────────────────────

/**
 * MANUAL — entrada via formulário.
 * Confiança sempre 1.0: o usuário digitou cada campo explicitamente.
 */
export function normalizeManual(input: ManualFormInput): TransactionDraft {
  const amount = parseAmount(input.amount);
  const confidence = 1.0;
  const level = toConfidenceLevel(confidence);

  return {
    source: 'manual',
    rawInput: undefined,
    type: input.type,
    amount,
    currency: 'BRL',
    occurredAt: new Date().toISOString(),
    description: String(input.description ?? '').trim(),
    category: input.category,
    paymentMethod: input.paymentMethod,
    status: initialDraftStatus(level),
    confidence,
    confidenceLevel: level,
    accountId: input.accountId,
  };
}

/**
 * TEXT — interpretação de texto livre via IA (backend).
 * Confiança derivada do retorno do interpretador.
 */
export function normalizeFromAIText(input: AITextOutput): TransactionDraft {
  const confidence = Math.min(Math.max(input.confidence, 0), 1);
  const level = toConfidenceLevel(confidence);

  const fieldConfidences: FieldConfidences = {
    amount: input.data.amount > 0 ? confidence : 0.1,
    description: input.data.description?.length > 3 ? confidence : 0.3,
    type: input.data.type ? confidence : 0.4,
    category: input.data.category ? confidence * 0.9 : 0.2,
  };

  return {
    source: 'text',
    rawInput: input.rawInput,
    type: input.data.type ?? TransactionType.DESPESA,
    amount: parseAmount(input.data.amount),
    currency: 'BRL',
    occurredAt: new Date().toISOString(),
    description: String(input.data.description ?? '').trim(),
    category: input.data.category,
    status: initialDraftStatus(level),
    confidence,
    confidenceLevel: level,
    fieldConfidences,
    accountId: input.accountId,
  };
}

/**
 * SCANNER — extração de imagem/recibo via IA (backend).
 * Confiança derivada do retorno do scanner ou do interpretador de imagem.
 */
export function normalizeFromAIImage(input: AIImageOutput): TransactionDraft {
  const confidence = Math.min(Math.max(input.confidence, 0), 1);
  const level = toConfidenceLevel(confidence);

  const fieldConfidences: FieldConfidences = {
    amount: input.data.amount > 0 ? Math.min(confidence + 0.1, 1) : 0.1,
    description: input.data.description?.length > 3 ? confidence : 0.3,
    type: input.data.type ? confidence : 0.4,
    category: input.data.category ? confidence * 0.9 : 0.2,
  };

  return {
    source: 'scanner',
    rawInput: `[image:${input.mimeType ?? 'unknown'}]`,
    type: input.data.type ?? TransactionType.DESPESA,
    amount: parseAmount(input.data.amount),
    currency: 'BRL',
    occurredAt: new Date().toISOString(),
    description: String(input.data.description ?? '').trim(),
    category: input.data.category,
    status: initialDraftStatus(level),
    confidence,
    confidenceLevel: level,
    fieldConfidences,
    accountId: input.accountId,
  };
}

/**
 * FILE — importação de arquivo CSV/OFX/PDF.
 * Dados determinísticos têm confiança 0.9; descrições pobres ficam menores.
 */
export function normalizeFromFileImport(row: FileImportRow): TransactionDraft {
  const baseConf = row.confidence ?? 0.85;
  const descriptionConf = row.description.length > 6 ? baseConf : 0.4;
  const confidence = (baseConf + descriptionConf) / 2;
  const level = toConfidenceLevel(confidence);

  const fieldConfidences: FieldConfidences = {
    amount: row.amount > 0 ? 0.95 : 0.1,
    occurredAt: 0.9,
    description: descriptionConf,
    type: row.type ? 0.9 : 0.5,
    category: row.category ? baseConf * 0.8 : 0.2,
  };

  const compositeDescription = row.merchant && row.merchant !== row.description
    ? `${row.description} — ${row.merchant}`
    : row.description;

  return {
    source: row.source ?? 'file',
    rawInput: row.description,
    type: row.type ?? TransactionType.DESPESA,
    amount: row.amount,
    currency: 'BRL',
    occurredAt: safeIso(row.date),
    description: compositeDescription.trim(),
    category: row.category,
    status: initialDraftStatus(level),
    confidence,
    confidenceLevel: level,
    fieldConfidences,
  };
}

/**
 * INTEGRATION — payload vindo de sistema externo.
 * Dados bem estruturados mas confiança máxima 0.95 (validação ainda necessária).
 */
export function normalizeFromIntegration(payload: IntegrationPayload): TransactionDraft {
  const confidence = 0.92;
  const level = toConfidenceLevel(confidence);

  return {
    source: 'integration',
    rawInput: undefined,
    type: payload.type,
    amount: parseAmount(payload.amount),
    currency: payload.currency ?? 'BRL',
    occurredAt: safeIso(payload.occurredAt),
    description: String(payload.description ?? '').trim(),
    category: payload.category,
    status: initialDraftStatus(level),
    confidence,
    confidenceLevel: level,
    externalReference: payload.externalReference,
  };
}

/**
 * Converte um TransactionDraft salvo de volta para o shape mínimo
 * esperado pelo storage/backend (`Partial<Transaction>`).
 *
 * Apenas campos estruturalmente seguros são emitidos — sem rawInput,
 * sem fieldConfidences, sem status intermediário de draft.
 */
export function draftToTransaction(
  draft: TransactionDraft,
): Record<string, unknown> {
  return {
    amount: draft.amount,
    type: draft.type,
    category: draft.category,
    description: draft.description,
    date: draft.occurredAt,
    source: draft.source === 'scanner'
      ? 'ai_image'
      : draft.source === 'text'
      ? 'ai_text'
      : draft.source === 'file'
      ? 'import'
      : draft.source,
    confidence_score: draft.confidence,
    payment_method: draft.paymentMethod,
    account_id: draft.accountId,
    ...(draft.externalReference ? { external_reference: draft.externalReference } : {}),
  };
}
