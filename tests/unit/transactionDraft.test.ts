/**
 * Testes unitários — src/domain/transactionDraft.ts
 *
 * Cobre: toConfidenceLevel, initialDraftStatus, hasUncertainFields, getUncertainFields
 */

import { describe, it, expect } from 'vitest';
import {
  toConfidenceLevel,
  initialDraftStatus,
  hasUncertainFields,
  getUncertainFields,
  FieldConfidences,
} from '../../src/domain/transactionDraft';

// ─── toConfidenceLevel ────────────────────────────────────────────────────────

describe('toConfidenceLevel', () => {
  it('retorna "high" quando confidence >= 0.8', () => {
    expect(toConfidenceLevel(1.0)).toBe('high');
    expect(toConfidenceLevel(0.8)).toBe('high');
    expect(toConfidenceLevel(0.9)).toBe('high');
  });

  it('retorna "medium" quando 0.5 <= confidence < 0.8', () => {
    expect(toConfidenceLevel(0.79)).toBe('medium');
    expect(toConfidenceLevel(0.5)).toBe('medium');
    expect(toConfidenceLevel(0.65)).toBe('medium');
  });

  it('retorna "low" quando confidence < 0.5', () => {
    expect(toConfidenceLevel(0.0)).toBe('low');
    expect(toConfidenceLevel(0.49)).toBe('low');
    expect(toConfidenceLevel(0.1)).toBe('low');
  });

  it('trata valores extremos sem crash', () => {
    expect(toConfidenceLevel(2.0)).toBe('high');   // acima de 1 ainda é high
    expect(toConfidenceLevel(-0.1)).toBe('low');   // abaixo de 0 ainda é low
  });
});

// ─── initialDraftStatus ───────────────────────────────────────────────────────

describe('initialDraftStatus', () => {
  it('retorna "ready" para nível high', () => {
    expect(initialDraftStatus('high')).toBe('ready');
  });

  it('retorna "pending_review" para nível medium', () => {
    expect(initialDraftStatus('medium')).toBe('pending_review');
  });

  it('retorna "pending_review" para nível low', () => {
    expect(initialDraftStatus('low')).toBe('pending_review');
  });
});

// ─── hasUncertainFields ───────────────────────────────────────────────────────

describe('hasUncertainFields', () => {
  it('retorna false quando fieldConfidences for undefined', () => {
    expect(hasUncertainFields(undefined)).toBe(false);
  });

  it('retorna false quando todos os campos têm confiança >= 0.5', () => {
    const fc: FieldConfidences = { amount: 0.9, description: 0.8, type: 0.7 };
    expect(hasUncertainFields(fc)).toBe(false);
  });

  it('retorna true quando pelo menos um campo tem confiança < 0.5', () => {
    const fc: FieldConfidences = { amount: 0.9, description: 0.3, type: 0.7 };
    expect(hasUncertainFields(fc)).toBe(true);
  });

  it('retorna true quando category está abaixo do limiar', () => {
    const fc: FieldConfidences = { amount: 0.9, category: 0.2 };
    expect(hasUncertainFields(fc)).toBe(true);
  });

  it('retorna false para objeto vazio', () => {
    expect(hasUncertainFields({})).toBe(false);
  });

  it('ignora campos com valor undefined dentro do objeto', () => {
    const fc: FieldConfidences = { amount: 0.9, description: undefined };
    expect(hasUncertainFields(fc)).toBe(false);
  });
});

// ─── getUncertainFields ───────────────────────────────────────────────────────

describe('getUncertainFields', () => {
  it('retorna lista vazia quando todos os campos são confiáveis', () => {
    const fc: FieldConfidences = { amount: 0.9, description: 0.8 };
    expect(getUncertainFields(fc)).toEqual([]);
  });

  it('retorna campos abaixo de 0.5 (limiar padrão)', () => {
    const fc: FieldConfidences = { amount: 0.9, description: 0.3, category: 0.2 };
    const result = getUncertainFields(fc);
    expect(result).toContain('description');
    expect(result).toContain('category');
    expect(result).not.toContain('amount');
  });

  it('respeita limiar customizado', () => {
    const fc: FieldConfidences = { amount: 0.9, description: 0.7, type: 0.6 };
    const result = getUncertainFields(fc, 0.8);  // threshold elevado
    expect(result).toContain('description');
    expect(result).toContain('type');
    expect(result).not.toContain('amount');
  });

  it('inclui paymentMethod e occurredAt quando presentes e abaixo do limiar', () => {
    const fc: FieldConfidences = {
      amount: 0.9,
      occurredAt: 0.4,
      paymentMethod: 0.3,
    };
    const result = getUncertainFields(fc);
    expect(result).toContain('occurredAt');
    expect(result).toContain('paymentMethod');
  });

  it('ignora campos com valor undefined', () => {
    const fc: FieldConfidences = { amount: undefined, description: 0.3 };
    const result = getUncertainFields(fc);
    expect(result).toContain('description');
    expect(result).not.toContain('amount');
  });

  it('retorna lista vazia para objeto vazio', () => {
    expect(getUncertainFields({})).toEqual([]);
  });
});
