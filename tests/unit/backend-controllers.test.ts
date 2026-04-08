/**
 * TESTES BACKEND - Controllers de IA
 * Versão: 0.4.0
 * Coverage alvo: 98%+
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as aiConfig from '../../backend/src/config/ai';
import { cfoController, generateInsightsController, interpretController } from '../../backend/src/controllers/aiController';
import { loginController, logoutController, refreshController } from '../../backend/src/controllers/authController';
import { decodeToken } from '../../backend/src/middleware/auth';
import { getRefreshStoreSize, resetRefreshStoreForTests } from '../../backend/src/services/auth/refreshTokenStore';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../backend/src/config/ai');
vi.mock('../../backend/src/config/logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockRequest(body: any, userId: string = 'test-user') {
  return {
    body,
    userId,
    userEmail: 'test@flow.finance',
    headers: {},
  };
}

function createMockResponse() {
  const res = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return res;
}

async function flushAsyncHandler() {
  await Promise.resolve();
  await Promise.resolve();
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

    cfoController(req as any, res as any, vi.fn());
    await flushAsyncHandler();

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

    cfoController(req as any, res as any, next);
    await flushAsyncHandler();

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

    cfoController(req as any, res as any, next);
    await flushAsyncHandler();

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(500);
    expect(error.message).toContain('Failed to generate CFO response');
  });
});

describe('AI Fallback Controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('interpretController retorna fallback quando provedor falha', async () => {
    vi.spyOn(aiConfig, 'generateContent').mockRejectedValueOnce(new Error('provider offline'));

    const req = createMockRequest({ text: 'gastei 50 no mercado' });
    const res = createMockResponse();

    interpretController(req as any, res as any, vi.fn());
    await flushAsyncHandler();

    expect(res.json).toHaveBeenCalledWith({ intent: 'transaction', data: [] });
  });

  it('generateInsightsController retorna fallback daily quando provedor falha', async () => {
    vi.spyOn(aiConfig, 'generateContent').mockRejectedValueOnce(new Error('provider offline'));

    const req = createMockRequest({
      transactions: [{ amount: 10, description: 'mercado', category: 'Pessoal', type: 'Despesa' }],
      type: 'daily',
    });
    const res = createMockResponse();

    generateInsightsController(req as any, res as any, vi.fn());
    await flushAsyncHandler();

    expect(res.json).toHaveBeenCalledWith({ insights: [] });
  });
});

describe('Auth Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRefreshStoreForTests();
  });

  it('loginController preserva userId informado pelo frontend', async () => {
    const req = createMockRequest({
      email: 'firebase-user@flow.test',
      password: 'firebase-session',
      userId: 'firebase-uid-123',
    });
    const res = createMockResponse();

    loginController(req as any, res as any, vi.fn());
    await flushAsyncHandler();

    const payload = res.json.mock.calls[0][0];
    const decoded = decodeToken(payload.token);

    expect(payload.user.userId).toBe('firebase-uid-123');
    expect(decoded?.userId).toBe('firebase-uid-123');
  });

  it('loginController retorna accessToken e refreshToken', async () => {
    const req = createMockRequest({
      email: 'refresh-user@flow.test',
      password: '123456',
    });
    const res = createMockResponse();

    loginController(req as any, res as any, vi.fn());
    await flushAsyncHandler();

    const payload = res.json.mock.calls[0][0];
    expect(payload.token).toBeTruthy();
    expect(payload.accessToken).toBeTruthy();
    expect(payload.refreshToken).toBeTruthy();
    expect(payload.refreshExpiresIn).toBeGreaterThan(0);
    expect(getRefreshStoreSize()).toBe(1);
  });

  it('refreshController rotaciona refresh token e invalida o token anterior', async () => {
    const loginReq = createMockRequest({
      email: 'rotate-user@flow.test',
      password: '123456',
    });
    const loginRes = createMockResponse();
    const next = vi.fn();

    loginController(loginReq as any, loginRes as any, next);
    await flushAsyncHandler();

    const loginPayload = loginRes.json.mock.calls[0][0];
    const oldRefreshToken = loginPayload.refreshToken as string;

    const refreshReq = createMockRequest({ refreshToken: oldRefreshToken });
    const refreshRes = createMockResponse();
    const refreshNext = vi.fn();
    refreshController(refreshReq as any, refreshRes as any, refreshNext);
    await flushAsyncHandler();

    expect(refreshNext).not.toHaveBeenCalled();
    const refreshPayload = refreshRes.json.mock.calls[0][0];
    expect(refreshPayload.accessToken).toBeTruthy();
    expect(refreshPayload.refreshToken).toBeTruthy();
    expect(refreshPayload.refreshToken).not.toBe(oldRefreshToken);

    // Reuso do refresh token antigo deve falhar.
    const reusedReq = createMockRequest({ refreshToken: oldRefreshToken });
    const reusedRes = createMockResponse();
    const reusedNext = vi.fn();
    refreshController(reusedReq as any, reusedRes as any, reusedNext);
    await flushAsyncHandler();

    expect(reusedNext).toHaveBeenCalled();
    const reusedErr = reusedNext.mock.calls[0][0];
    expect(reusedErr.statusCode).toBe(401);
  });

  it('logoutController revoga refresh token informado', async () => {
    const loginReq = createMockRequest({
      email: 'logout-user@flow.test',
      password: '123456',
    });
    const loginRes = createMockResponse();
    loginController(loginReq as any, loginRes as any, vi.fn());
    await flushAsyncHandler();

    const payload = loginRes.json.mock.calls[0][0];
    const refreshToken = payload.refreshToken as string;

    const logoutReq = createMockRequest({ refreshToken }, payload.user.userId);
    const logoutRes = createMockResponse();
    logoutController(logoutReq as any, logoutRes as any, vi.fn());
    await flushAsyncHandler();

    expect(logoutRes.json).toHaveBeenCalled();

    const refreshReq = createMockRequest({ refreshToken });
    const refreshRes = createMockResponse();
    const refreshNext = vi.fn();
    refreshController(refreshReq as any, refreshRes as any, refreshNext);
    await flushAsyncHandler();

    expect(refreshNext).toHaveBeenCalled();
    const err = refreshNext.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
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
