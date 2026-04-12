import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Category, TransactionType } from '../../../types';
import {
  classifyTransactionsWithAI,
  sugerirCategoriaIA,
} from '../../../src/services/ai/categorizationService';
import {
  buildCanonicalCategorizationResult,
  normalizeToFinanceCategory,
  normalizeToProductCategory,
} from '../../../src/services/ai/categorizationSchema';

vi.mock('../../../src/config/api.config', () => ({
  API_ENDPOINTS: {
    AI: {
      CLASSIFY_TRANSACTIONS: 'http://localhost:3001/api/ai/classify-transactions',
    },
  },
  apiRequest: vi.fn(),
}));

const { apiRequest } = await import('../../../src/config/api.config');

describe('categorizationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('normaliza categorias de produto e do motor financeiro no mesmo contrato', () => {
    expect(normalizeToProductCategory('Negócio')).toBe(Category.NEGOCIO);
    expect(normalizeToProductCategory('alimentação')).toBe(Category.PESSOAL);
    expect(normalizeToFinanceCategory('Trabalho / Consultório')).toBe('servicos');
    expect(normalizeToFinanceCategory('investimento')).toBe('banco');
  });

  it('constrói resultado canônico com projeção dupla', () => {
    const result = buildCanonicalCategorizationResult({
      category: 'Trabalho',
      confidence: 0.82,
      type: TransactionType.DESPESA,
      source: 'ai',
    });

    expect(result.category).toBe(Category.CONSULTORIO);
    expect(result.financeCategory).toBe('servicos');
    expect(result.type).toBe(TransactionType.DESPESA);
    expect(result.confidence).toBe(0.82);
  });

  it('classifyTransactionsWithAI usa contrato canônico do backend', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([
      { category: 'Negócio', type: 'Receita', confidence: 0.91 },
    ]);

    const [result] = await classifyTransactionsWithAI([
      { description: 'Pagamento cliente', amount: 500, date: '2026-04-11T00:00:00.000Z' },
    ]);

    expect(result.category).toBe(Category.NEGOCIO);
    expect(result.financeCategory).toBe('servicos');
    expect(result.type).toBe(TransactionType.RECEITA);
    expect(result.source).toBe('ai');
  });

  it('retorna fallback canônico quando a classificação remota falha', async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('provider_down'));

    const [result] = await classifyTransactionsWithAI([
      { description: 'Despesa sem contexto', type: TransactionType.DESPESA },
    ]);

    expect(result.category).toBe(Category.PESSOAL);
    expect(result.financeCategory).toBe('outros');
    expect(result.source).toBe('fallback');
    expect(result.erro).toContain('provider_down');
  });

  it('sugerirCategoriaIA usa o serviço canônico e não retorna stub', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([
      { category: 'Pessoal', type: 'Despesa', confidence: 0.77 },
    ]);

    const result = await sugerirCategoriaIA({ description: 'Uber', merchant: 'Uber' });

    expect(result.erro).toBeUndefined();
    expect(result.categoria).toBe(Category.PESSOAL);
    expect(result.confidence).toBe(0.77);
  });
});
