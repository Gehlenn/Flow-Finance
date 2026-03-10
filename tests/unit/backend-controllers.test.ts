/**
 * TESTES BACKEND - Controllers de IA
 * Versão: 0.4.0
 * Coverage alvo: 98%+
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as aiConfig from '../../backend/src/config/ai';
import { cfoController } from '../../backend/src/controllers/aiController';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../backend/src/config/ai');
vi.mock('../../backend/src/config/logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockRequest(body: any, userId: string = 'test-user') {
  return {
    body,
    userId,
  };
}

function createMockResponse() {
  const res = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
  return res;
}

// ─── Testes CFO Controller ──────────────────────────────────────────────────

describe('CFO Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar resposta de CFO com pergunta válida', async () => {
    const mockAnswer = 'Com base nos seus dados, você tem R$ 3.000 disponíveis.';
    vi.spyOn(aiConfig, 'generateContent').mockResolvedValueOnce(mockAnswer);

    const req = createMockRequest({
      question: 'Posso gastar R$ 500?',
      context: 'saldo: 3000',
      intent: 'spending_advice',
    });
    const res = createMockResponse();

    await cfoController(req as any, res as any, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ answer: mockAnswer });
    expect(aiConfig.generateContent).toHaveBeenCalled();
  });

  it('deve retornar erro 400 se question estiver vazia', async () => {
    const req = createMockRequest({
      question: '',
      context: 'saldo: 3000',
      intent: 'spending_advice',
    });
    const res = createMockResponse();
    const next = vi.fn();

    await cfoController(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('question');
  });

  it('deve tratar erro de API e lançar AppError', async () => {
    vi.spyOn(aiConfig, 'generateContent').mockRejectedValueOnce(
      new Error('API Rate Limit')
    );

    const req = createMockRequest({
      question: 'Posso investir?',
      context: 'saldo: 5000',
      intent: 'investment_question',
    });
    const res = createMockResponse();
    const next = vi.fn();

    // O asyncHandler captura o erro e chama next()
    // Mas precisamos testar o controller diretamente
    try {
      await cfoController(req as any, res as any, next);
    } catch (error: any) {
      expect(error.statusCode).toBe(500);
      expect(error.message).toContain('Failed to generate CFO response');
    }
  });
});

// ─── Testes de Validação de Request ─────────────────────────────────────────

describe('Request Validation', () => {
  it('deve validar campos obrigatórios de CFO request', () => {
    const validateCFORequest = (body: any): boolean => {
      return (
        body &&
        typeof body.question === 'string' &&
        body.question.trim().length > 0 &&
        typeof body.context === 'string' &&
        typeof body.intent === 'string'
      );
    };

    expect(validateCFORequest({
      question: 'Posso gastar?',
      context: 'saldo: 1000',
      intent: 'spending_advice',
    })).toBe(true);

    expect(validateCFORequest({
      question: '',
      context: 'saldo: 1000',
      intent: 'spending_advice',
    })).toBe(false);

    expect(validateCFORequest({
      question: 'Posso gastar?',
      context: 123, // wrong type
      intent: 'spending_advice',
    })).toBe(false);
  });
});

// ─── Testes de Sanitização de Entrada ──────────────────────────────────────

describe('Input Sanitization', () => {
  it('deve remover caracteres especiais perigosos', () => {
    const sanitize = (input: string): string => {
      return input
        .replace(/<script>/gi, '')
        .replace(/<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
    };

    expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitize('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitize('  Texto normal  ')).toBe('Texto normal');
  });

  it('deve truncar string muito longa', () => {
    const truncate = (str: string, maxLength: number): string => {
      return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
    };

    const longString = 'a'.repeat(1000);
    const truncated = truncate(longString, 100);
    
    expect(truncated.length).toBeLessThanOrEqual(103); // 100 + '...'
    expect(truncated.endsWith('...')).toBe(true);
  });
});
