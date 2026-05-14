import { describe, expect, it, vi } from 'vitest';

const memoryMocks = vi.hoisted(() => ({
  getSpendingPatterns: vi.fn(),
  getUserBehaviors: vi.fn(),
  getFinancialProfile: vi.fn(),
  getMerchantCategories: vi.fn(),
  buildFinancialGraph: vi.fn(),
  graphToAIContext: vi.fn(),
  logWarn: vi.fn(),
}));
const geminiMocks = vi.hoisted(() => ({
  mockGenerateCFO: vi.fn(),
}));

vi.mock('../../src/ai/memory', () => ({
  getSpendingPatterns: memoryMocks.getSpendingPatterns,
  getUserBehaviors: memoryMocks.getUserBehaviors,
  getFinancialProfile: memoryMocks.getFinancialProfile,
  getMerchantCategories: memoryMocks.getMerchantCategories,
}));

vi.mock('../../src/ai/financialGraph', () => ({
  buildFinancialGraph: memoryMocks.buildFinancialGraph,
  graphToAIContext: memoryMocks.graphToAIContext,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: memoryMocks.logWarn,
}));

vi.mock('../../services/geminiService', () => ({
  GeminiService: vi.fn().mockImplementation(() => ({
    generateCFO: geminiMocks.mockGenerateCFO,
  })),
}));

import { buildFinancialContext, generateCFOResponse } from '../../src/ai/aiCFO';
import { Category, TransactionType, type Transaction } from '../../types';
import { type Account } from '../../models/Account';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: overrides.id || 'acc-1',
    user_id: overrides.user_id || 'user-1',
    name: overrides.name || 'Conta',
    type: overrides.type || 'cash',
    balance: overrides.balance ?? 0,
    currency: overrides.currency || 'BRL',
    created_at: overrides.created_at || '2026-04-01T00:00:00.000Z',
  } as Account;
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? TransactionType.RECEITA,
    category: overrides.category ?? Category.NEGOCIO,
    description: overrides.description ?? 'Receita',
    date: overrides.date ?? '2026-04-10',
    source: overrides.source ?? 'manual',
    generated: overrides.generated ?? false,
    confidence_score: overrides.confidence_score ?? 1,
    account_id: overrides.account_id ?? 'acc-1',
    merchant: overrides.merchant,
  };
}

describe('aiCFO observability', () => {
  it('logs contextual data when CFO response falls back on empty answer', async () => {
    geminiMocks.mockGenerateCFO.mockResolvedValueOnce({ answer: '   ' });

    const response = await generateCFOResponse('Posso gastar?', 'contexto', 'spending_advice');

    expect(response.answer).toContain('Nao foi possivel gerar uma resposta no momento.');
    expect(response.diagnostic).toEqual(expect.objectContaining({
      kind: 'ai_unavailable',
    }));
    expect(memoryMocks.logWarn).toHaveBeenCalledWith(
      '[AI CFO] Empty CFO response; returning fallback diagnostic',
      expect.objectContaining({
        intent: 'spending_advice',
        fallback: 'ai-cfo-empty-response',
      }),
    );
  });

  it('logs contextual data when CFO generation fails', async () => {
    geminiMocks.mockGenerateCFO.mockRejectedValueOnce(new Error('llm offline'));

    const response = await generateCFOResponse('Posso gastar?', 'contexto', 'spending_advice');

    expect(response.answer).toContain('nao consegui processar a consulta agora');
    expect(response.diagnostic).toEqual(expect.objectContaining({
      kind: 'ai_unavailable',
    }));
    expect(memoryMocks.logWarn).toHaveBeenCalledWith(
      '[AI CFO] Failed to generate CFO response; returning fallback diagnostic',
      expect.objectContaining({
        intent: 'spending_advice',
        fallback: 'ai-cfo-response-failed',
      }),
    );
  });

  it('logs contextual data when AI memory loading fails inside buildFinancialContext', () => {
    memoryMocks.getSpendingPatterns.mockImplementation(() => {
      throw new Error('memory offline');
    });
    memoryMocks.getUserBehaviors.mockReturnValue([]);
    memoryMocks.getFinancialProfile.mockReturnValue(null);
    memoryMocks.getMerchantCategories.mockReturnValue([]);
    memoryMocks.buildFinancialGraph.mockReturnValue({});
    memoryMocks.graphToAIContext.mockReturnValue('');

    const context = buildFinancialContext(
      [makeAccount({ balance: 500 })],
      [makeTransaction()],
      {
        balance_7_days: 0,
        balance_30_days: 0,
        current_balance: 0,
        projected_expenses: 0,
        projected_income: 0,
      },
      [],
      'user-1',
    );

    expect(context).toContain('DADOS FINANCEIROS DO USUÁRIO');
    expect(memoryMocks.logWarn).toHaveBeenCalledWith(
      '[buildFinancialContext] Failed to load AI memories; continuing without behavioral context',
      expect.objectContaining({
        userId: 'user-1',
        error: expect.any(Error),
      }),
    );
  });

  it('logs contextual data when graph enrichment fails inside buildFinancialContext', () => {
    memoryMocks.getSpendingPatterns.mockReturnValue([]);
    memoryMocks.getUserBehaviors.mockReturnValue([]);
    memoryMocks.getFinancialProfile.mockReturnValue(null);
    memoryMocks.getMerchantCategories.mockReturnValue([]);
    memoryMocks.buildFinancialGraph.mockImplementation(() => {
      throw new Error('graph offline');
    });
    memoryMocks.graphToAIContext.mockReturnValue('');

    const context = buildFinancialContext(
      [makeAccount({ balance: 500 })],
      [makeTransaction()],
      {
        balance_7_days: 0,
        balance_30_days: 0,
        current_balance: 0,
        projected_expenses: 0,
        projected_income: 0,
      },
      [],
      'user-1',
    );

    expect(context).toContain('DADOS FINANCEIROS DO USUÃRIO');
    expect(memoryMocks.logWarn).toHaveBeenCalledWith(
      '[buildFinancialContext] Graph context unavailable; continuing without graph enrichment',
      expect.objectContaining({
        userId: 'user-1',
        error: expect.any(Error),
      }),
    );
  });
});
