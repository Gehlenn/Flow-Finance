import { describe, expect, it, vi, beforeEach } from 'vitest';

// vi.mock is hoisted before const declarations — must use vi.hoisted() to
// initialise the mock reference before the factory runs.
const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock('../../src/config/api.config', () => ({
  API_ENDPOINTS: {
    AI: {
      INTERPRET: '/api/ai/interpret',
      SCAN_RECEIPT: '/api/ai/scan-receipt',
      GENERATE_INSIGHTS: '/api/ai/insights',
      CLASSIFY_TRANSACTIONS: '/api/ai/classify-transactions',
      CREDIT_TOKEN_COUNT: '/api/ai/token-count',
      CFO: '/api/ai/cfo',
    },
  },
  apiRequest: apiRequestMock,
}));

import { buildSmartInputFallback, GeminiService } from '../../services/geminiService';
import { TransactionType, Category } from '../../types';

describe('buildSmartInputFallback', () => {
  it('gera transacao de despesa quando encontra valor em texto de gasto', () => {
    const output = buildSmartInputFallback('Gastei 50 no uber hoje');

    expect(output.intent).toBe('transaction');
    expect(output.data).toHaveLength(1);
    const tx = output.data[0] as any;
    expect(tx.amount).toBe(50);
    expect(tx.type).toBe(TransactionType.DESPESA);
    expect(tx.category).toBe(Category.PESSOAL);
  });

  it('gera transacao de receita para texto de recebimento', () => {
    const output = buildSmartInputFallback('Recebi 2500 de salario');

    expect(output.intent).toBe('transaction');
    const tx = output.data[0] as any;
    expect(tx.amount).toBe(2500);
    expect(tx.type).toBe(TransactionType.RECEITA);
    expect(tx.category).toBe(Category.CONSULTORIO);
  });

  it('gera lembrete para texto de pagamento', () => {
    const output = buildSmartInputFallback('Lembrar de pagar luz dia 10');

    expect(output.intent).toBe('reminder');
    expect(output.data).toHaveLength(1);
    const reminder = output.data[0] as any;
    expect(reminder.title).toContain('Lembrar de pagar luz');
    expect(reminder.priority).toBe('média');
  });

  it('retorna vazio para texto sem valor quando nao for lembrete', () => {
    const output = buildSmartInputFallback('teste aleatorio sem contexto financeiro');
    expect(output.intent).toBe('transaction');
    expect(output.data).toHaveLength(0);
  });
});

describe('GeminiService.processSmartInput', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('usa fallback deterministico quando apiRequest falha', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('backend offline'));
    const service = new GeminiService();

    const output = await service.processSmartInput('Comprei 89,90 no mercado');

    expect(output.intent).toBe('transaction');
    const tx = output.data[0] as any;
    expect(tx.amount).toBe(89.9);
    expect(tx.type).toBe(TransactionType.DESPESA);
  });
});
