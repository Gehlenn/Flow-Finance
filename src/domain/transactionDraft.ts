/**
 * TRANSACTION DRAFT — Modelo unificado de intake
 *
 * Todo ponto de entrada (manual, texto, scanner, arquivo, integração)
 * deve produzir este draft antes de qualquer persistência.
 *
 * Regra: nada é salvo diretamente de fluxos paralelos.
 * Tudo converge aqui primeiro.
 */

import { TransactionType, Category } from '../../types';

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

/** Origens de entrada suportadas */
export type DraftSource = 'manual' | 'text' | 'scanner' | 'file' | 'integration';

/** Status do draft no pipeline de intake */
export type DraftStatus = 'pending_review' | 'ready' | 'saved' | 'discarded';

/**
 * Nível de confiança global do draft.
 * - high: campos extraídos com alta certeza — draft quase pronto para salvar
 * - medium: campos parcialmente incertos — abrir revisão com destaques
 * - low: extração fraca — forçar revisão com marcadores visíveis de incerteza
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Confiança por campo individual (0–1).
 * Presente quando a origem não é manual (evita falsa precisão em dados estruturados).
 */
export interface FieldConfidences {
  amount?: number;
  occurredAt?: number;
  description?: number;
  type?: number;
  category?: number;
  paymentMethod?: number;
}

// ─── Draft Model ──────────────────────────────────────────────────────────────

/**
 * TransactionDraft — representação intermediária de qualquer entrada de transação.
 *
 * Campos obrigatórios para criação:
 *   source, type, amount, currency, occurredAt, description
 *
 * Campos opcionais enriquecidos por IA ou parsing:
 *   category, subcategory, paymentMethod, fieldConfidences, attachmentRef,
 *   externalReference, rawInput
 */
export interface TransactionDraft {
  /** Origem da entrada */
  source: DraftSource;

  /** Input bruto original (texto digitado, path de imagem, nome de arquivo, etc.) */
  rawInput?: string;

  /** Tipo financeiro da transação */
  type: TransactionType;

  /** Valor absoluto em unidade monetária */
  amount: number;

  /** Código de moeda ISO 4217 (padrão: 'BRL') */
  currency: string;

  /** Data/hora da ocorrência — ISO 8601 */
  occurredAt: string;

  /** Descrição textual da transação */
  description: string;

  /** Categoria (pode vir de IA ou de seleção manual) */
  category?: Category;

  /** Subcategoria opcional */
  subcategory?: string;

  /** Método de pagamento */
  paymentMethod?: 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'transfer';

  /** Status atual no pipeline */
  status: DraftStatus;

  /**
   * Confiança geral do draft (0–1).
   * 1.0 = entrada manual (certeza total).
   * Calculado por IA ou heurística de parsing para as demais origens.
   */
  confidence: number;

  /** Nível semântico de confiança derivado do valor numérico */
  confidenceLevel: ConfidenceLevel;

  /** Confiança individual por campo — presente quando source !== 'manual' */
  fieldConfidences?: FieldConfidences;

  /** Referência a arquivo ou imagem anexada */
  attachmentRef?: string;

  /**
   * Identificador externo para rastreabilidade.
   * Usado em integrações (ex: ID de cobrança do sistema externo).
   */
  externalReference?: string;

  /** ID da conta associada */
  accountId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converte um valor numérico de confiança (0–1) para nível semântico.
 * - >= 0.80 → high
 * - >= 0.50 → medium
 * - < 0.50  → low
 */
export function toConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Determina o DraftStatus inicial com base no nível de confiança.
 * - high → 'ready' (quase pronto, ainda passa por revisão rápida de UI)
 * - medium | low → 'pending_review'
 */
export function initialDraftStatus(level: ConfidenceLevel): DraftStatus {
  return level === 'high' ? 'ready' : 'pending_review';
}

/**
 * Retorna true se algum campo sensível tem confiança baixa (< 0.5).
 * Usado pela UI para decidir quais campos destacar.
 */
export function hasUncertainFields(fieldConfidences?: FieldConfidences): boolean {
  if (!fieldConfidences) return false;
  return Object.values(fieldConfidences).some(v => v !== undefined && v < 0.5);
}

/**
 * Lista os campos com confiança abaixo do limiar fornecido.
 */
export function getUncertainFields(
  fieldConfidences: FieldConfidences,
  threshold = 0.5,
): Array<keyof FieldConfidences> {
  return (Object.entries(fieldConfidences) as Array<[keyof FieldConfidences, number | undefined]>)
    .filter(([, v]) => v !== undefined && v < threshold)
    .map(([k]) => k);
}
