/**
 * Testes unitários — src/domain/intakeNormalizer.ts
 *
 * Cobre todos os normalizadores e draftToTransaction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeManual,
  normalizeFromAIText,
  normalizeFromAIImage,
  normalizeFromFileImport,
  normalizeFromIntegration,
  draftToTransaction,
  ManualFormInput,
  AITextOutput,
  AIImageOutput,
  FileImportRow,
  IntegrationPayload,
} from '../../src/domain/intakeNormalizer';
import { TransactionType, Category } from '../../types';

// ─── normalizeManual ──────────────────────────────────────────────────────────

describe('normalizeManual', () => {
  const base: ManualFormInput = {
    description: 'Aluguel',
    amount: 1200,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    accountId: 'acc-1',
  };

  it('produz draft com source "manual"', () => {
    expect(normalizeManual(base).source).toBe('manual');
  });

  it('confiança sempre 1.0', () => {
    expect(normalizeManual(base).confidence).toBe(1.0);
  });

  it('confidenceLevel sempre "high"', () => {
    expect(normalizeManual(base).confidenceLevel).toBe('high');
  });

  it('status sempre "ready"', () => {
    expect(normalizeManual(base).status).toBe('ready');
  });

  it('não adiciona fieldConfidences (entrada manual sem incerteza)', () => {
    expect(normalizeManual(base).fieldConfidences).toBeUndefined();
  });

  it('converte string de amount para número positivo', () => {
    const draft = normalizeManual({ ...base, amount: 'R$ 350,99' });
    expect(draft.amount).toBeCloseTo(350.99);
  });

  it('garante valor positivo mesmo para amounts negativos', () => {
    const draft = normalizeManual({ ...base, amount: -500 });
    expect(draft.amount).toBe(500);
  });

  it('propaga category e accountId', () => {
    const draft = normalizeManual(base);
    expect(draft.category).toBe(Category.PESSOAL);
    expect(draft.accountId).toBe('acc-1');
  });

  it('currency padrão é BRL', () => {
    expect(normalizeManual(base).currency).toBe('BRL');
  });
});

// ─── normalizeFromAIText ──────────────────────────────────────────────────────

describe('normalizeFromAIText', () => {
  const base: AITextOutput = {
    data: {
      amount: 120,
      description: 'Pizza delivery',
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
    },
    confidence: 0.85,
    rawInput: 'paguei 120 no ifood',
    accountId: 'acc-2',
  };

  it('source é "text"', () => {
    expect(normalizeFromAIText(base).source).toBe('text');
  });

  it('rawInput é preservado', () => {
    expect(normalizeFromAIText(base).rawInput).toBe('paguei 120 no ifood');
  });

  it('confidence e confidenceLevel corretos para 0.85', () => {
    const draft = normalizeFromAIText(base);
    expect(draft.confidence).toBe(0.85);
    expect(draft.confidenceLevel).toBe('high');
  });

  it('status "ready" para confidence >= 0.8', () => {
    expect(normalizeFromAIText(base).status).toBe('ready');
  });

  it('status "pending_review" para confidence < 0.8', () => {
    const lowConf = { ...base, confidence: 0.6 };
    expect(normalizeFromAIText(lowConf).status).toBe('pending_review');
  });

  it('fieldConfidences presente para origem não-manual', () => {
    const draft = normalizeFromAIText(base);
    expect(draft.fieldConfidences).toBeDefined();
    expect(Object.keys(draft.fieldConfidences!)).toContain('amount');
  });

  it('campo amount em fieldConfidences tem confiança baixa quando amount=0', () => {
    const noAmount = { ...base, data: { ...base.data, amount: 0 } };
    const draft = normalizeFromAIText(noAmount);
    expect(draft.fieldConfidences!.amount).toBe(0.1);
  });

  it('clampeia confidence fora de [0,1]', () => {
    const over = { ...base, confidence: 1.5 };
    expect(normalizeFromAIText(over).confidence).toBe(1.0);

    const under = { ...base, confidence: -0.5 };
    expect(normalizeFromAIText(under).confidence).toBe(0.0);
  });
});

// ─── normalizeFromAIImage ─────────────────────────────────────────────────────

describe('normalizeFromAIImage', () => {
  const base: AIImageOutput = {
    data: {
      amount: 55.5,
      description: 'Supermercado ABC',
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
    },
    confidence: 0.75,
    mimeType: 'image/jpeg',
  };

  it('source é "scanner"', () => {
    expect(normalizeFromAIImage(base).source).toBe('scanner');
  });

  it('rawInput inclui mimeType', () => {
    expect(normalizeFromAIImage(base).rawInput).toBe('[image:image/jpeg]');
  });

  it('rawInput usa "unknown" quando mimeType ausente', () => {
    const noMime = { ...base, mimeType: undefined };
    expect(normalizeFromAIImage(noMime).rawInput).toBe('[image:unknown]');
  });

  it('confidenceLevel "medium" para confidence 0.75', () => {
    expect(normalizeFromAIImage(base).confidenceLevel).toBe('medium');
  });

  it('fieldConfidences.amount é boosted quando amount > 0', () => {
    const draft = normalizeFromAIImage(base);
    // base amount confidence should be min(0.75 + 0.1, 1) = 0.85
    expect(draft.fieldConfidences!.amount).toBeCloseTo(0.85);
  });

  it('fieldConfidences.amount é 0.1 quando amount = 0', () => {
    const noAmount = { ...base, data: { ...base.data, amount: 0 } };
    expect(normalizeFromAIImage(noAmount).fieldConfidences!.amount).toBe(0.1);
  });
});

// ─── normalizeFromFileImport ──────────────────────────────────────────────────

describe('normalizeFromFileImport', () => {
  const base: FileImportRow = {
    amount: 200,
    date: '2024-03-15',
    description: 'Energia elétrica',
    merchant: 'CEMIG',
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
  };

  it('source padrão é "file"', () => {
    expect(normalizeFromFileImport(base).source).toBe('file');
  });

  it('description composta quando merchant difere', () => {
    const draft = normalizeFromFileImport(base);
    expect(draft.description).toBe('Energia elétrica — CEMIG');
  });

  it('description simples quando merchant igual à description', () => {
    const row = { ...base, merchant: 'Energia elétrica' };
    expect(normalizeFromFileImport(row).description).toBe('Energia elétrica');
  });

  it('occurredAt parseia data ISO corretamente', () => {
    const draft = normalizeFromFileImport(base);
    const d = new Date(draft.occurredAt);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2); // março (0-indexed)
  });

  it('fieldConfidences.amount é 0.95 para amounts positivos', () => {
    const draft = normalizeFromFileImport(base);
    expect(draft.fieldConfidences!.amount).toBe(0.95);
  });

  it('fieldConfidences.description baixa quando descrição curta', () => {
    const shortDesc: FileImportRow = { ...base, description: 'AB' };
    const draft = normalizeFromFileImport(shortDesc);
    expect(draft.fieldConfidences!.description).toBeLessThan(0.5);
  });

  it('status "pending_review" quando confidence < 0.8', () => {
    const row: FileImportRow = { ...base, description: 'AB', confidence: 0.3 };
    expect(normalizeFromFileImport(row).status).toBe('pending_review');
  });

  it('respeita source customizado da fileira', () => {
    const row: FileImportRow = { ...base, source: 'integration' };
    expect(normalizeFromFileImport(row).source).toBe('integration');
  });

  it('usa data atual quando date inválida', () => {
    const row: FileImportRow = { ...base, date: 'invalid-date' };
    const draft = normalizeFromFileImport(row);
    const diff = Date.now() - new Date(draft.occurredAt).getTime();
    expect(diff).toBeLessThan(5000); // dentro de 5 segundos
  });
});

// ─── normalizeFromIntegration ─────────────────────────────────────────────────

describe('normalizeFromIntegration', () => {
  const base: IntegrationPayload = {
    externalReference: 'cob-abc-123',
    amount: 350,
    currency: 'BRL',
    occurredAt: '2024-06-20T14:00:00.000Z',
    description: 'Consulta pagamento',
    type: TransactionType.RECEITA,
    category: Category.CONSULTORIO,
  };

  it('source é "integration"', () => {
    expect(normalizeFromIntegration(base).source).toBe('integration');
  });

  it('externalReference é preservado', () => {
    expect(normalizeFromIntegration(base).externalReference).toBe('cob-abc-123');
  });

  it('confidence é 0.92', () => {
    expect(normalizeFromIntegration(base).confidence).toBe(0.92);
  });

  it('confidenceLevel é "high" (0.92 >= 0.8)', () => {
    expect(normalizeFromIntegration(base).confidenceLevel).toBe('high');
  });

  it('status é "ready" para confidence 0.92', () => {
    expect(normalizeFromIntegration(base).status).toBe('ready');
  });

  it('currency customizada é preservada', () => {
    const usd = { ...base, currency: 'USD' };
    expect(normalizeFromIntegration(usd).currency).toBe('USD');
  });

  it('usa BRL quando currency não fornecida', () => {
    const noCurrency = { ...base, currency: undefined };
    expect(normalizeFromIntegration(noCurrency).currency).toBe('BRL');
  });
});

// ─── draftToTransaction ───────────────────────────────────────────────────────

describe('draftToTransaction', () => {
  it('mapeia source "scanner" → "ai_image"', () => {
    const base: ManualFormInput = {
      description: 'Mercado',
      amount: 100,
      type: TransactionType.DESPESA,
    };
    const draft = normalizeManual(base);
    (draft as any).source = 'scanner';
    expect(draftToTransaction(draft).source).toBe('ai_image');
  });

  it('mapeia source "text" → "ai_text"', () => {
    const base: AITextOutput = {
      data: { amount: 50, description: 'Taxi', type: TransactionType.DESPESA, category: undefined },
      confidence: 0.9,
      rawInput: 'paguei 50 de taxi',
    };
    const draft = normalizeFromAIText(base);
    expect(draftToTransaction(draft).source).toBe('ai_text');
  });

  it('mapeia source "file" → "import"', () => {
    const row: FileImportRow = {
      amount: 300,
      date: '2024-01-01',
      description: 'Fatura',
    };
    const draft = normalizeFromFileImport(row);
    expect(draftToTransaction(draft).source).toBe('import');
  });

  it('mantém source "manual" sem alteração', () => {
    const base: ManualFormInput = {
      description: 'Salário',
      amount: 5000,
      type: TransactionType.RECEITA,
    };
    const draft = normalizeManual(base);
    expect(draftToTransaction(draft).source).toBe('manual');
  });

  it('mantém source "integration" sem alteração', () => {
    const payload: IntegrationPayload = {
      externalReference: 'ext-001',
      amount: 200,
      occurredAt: new Date().toISOString(),
      description: 'Pagamento',
      type: TransactionType.RECEITA,
    };
    const draft = normalizeFromIntegration(payload);
    expect(draftToTransaction(draft).source).toBe('integration');
  });

  it('inclui external_reference quando externalReference presente', () => {
    const payload: IntegrationPayload = {
      externalReference: 'cob-999',
      amount: 150,
      occurredAt: new Date().toISOString(),
      description: 'Cobrança',
      type: TransactionType.RECEITA,
    };
    const result = draftToTransaction(normalizeFromIntegration(payload));
    expect(result.external_reference).toBe('cob-999');
  });

  it('não inclui external_reference quando ausente', () => {
    const base: ManualFormInput = {
      description: 'Despesa manual',
      amount: 100,
      type: TransactionType.DESPESA,
    };
    const result = draftToTransaction(normalizeManual(base));
    expect('external_reference' in result).toBe(false);
  });

  it('emite confidence_score corretamente', () => {
    const base: ManualFormInput = {
      description: 'Test',
      amount: 100,
      type: TransactionType.DESPESA,
    };
    const result = draftToTransaction(normalizeManual(base));
    expect(result.confidence_score).toBe(1.0);
  });

  it('não emite rawInput nem fieldConfidences nem status', () => {
    const base: AITextOutput = {
      data: { amount: 80, description: 'Uber', type: TransactionType.DESPESA, category: undefined, date: '' },
      confidence: 0.82,
      rawInput: 'paguei 80 uber',
    };
    const result = draftToTransaction(normalizeFromAIText(base));
    expect('rawInput' in result).toBe(false);
    expect('fieldConfidences' in result).toBe(false);
    expect('status' in result).toBe(false);
  });
});
