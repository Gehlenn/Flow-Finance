import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const envMock = {
    default: {
      OPENAI_API_KEY: 'openai-key',
      GEMINI_API_KEY: 'gemini-key',
      OPENAI_MODEL: 'gpt-4o-mini',
      GEMINI_MODEL: 'gemini-2.5-flash',
      AI_PRIMARY_PROVIDER: 'gemini',
      AI_FALLBACK_PROVIDER: 'openai',
      AI_TIMEOUT_MS: '30000',
    },
  };

  return {
    loggerMock,
    envMock,
    geminiGenerateContentMock: vi.fn(),
    openaiGenerateContentMock: vi.fn(),
  };
});

vi.mock('../../src/config/logger', () => ({
  default: mocks.loggerMock,
}));

vi.mock('../../src/config/env', () => mocks.envMock);

vi.mock('../../src/config/openai', () => ({
  generateContent: mocks.openaiGenerateContentMock,
  estimateTokens: vi.fn(),
}));

vi.mock('../../src/config/gemini', () => ({
  generateContent: mocks.geminiGenerateContentMock,
}));

import { generateContent } from '../../src/config/ai';

const baselineEnv = {
  OPENAI_API_KEY: 'openai-key',
  GEMINI_API_KEY: 'gemini-key',
  OPENAI_MODEL: 'gpt-4o-mini',
  GEMINI_MODEL: 'gemini-2.5-flash',
  AI_PRIMARY_PROVIDER: 'gemini',
  AI_FALLBACK_PROVIDER: 'openai',
  AI_TIMEOUT_MS: '30000',
};

describe('config/ai observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.envMock.default, baselineEnv);
  });

  it('registra tentativa, sucesso e metadados de operação', async () => {
    mocks.geminiGenerateContentMock.mockResolvedValueOnce('{"ok":true}');

    await expect(
      generateContent(
        'prompt de teste',
        { responseMimeType: 'application/json' },
        { operation: 'interpret', requestId: 'req-123', source: 'aiController' }
      )
    ).resolves.toBe('{"ok":true}');

    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_request_started',
        operation: 'interpret',
        requestId: 'req-123',
        responseMimeType: 'application/json',
        providerPlan: ['gemini', 'openai'],
      }),
      'AI request started'
    );

    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_provider_success',
        provider: 'gemini',
        operation: 'interpret',
        requestId: 'req-123',
      }),
      expect.stringContaining('response received successfully')
    );
  });

  it('registra fallback estruturado quando o provider primário falha', async () => {
    const quotaError = Object.assign(new Error('Rate limit exceeded'), { status: 429 });
    mocks.geminiGenerateContentMock.mockRejectedValueOnce(quotaError);
    mocks.openaiGenerateContentMock.mockResolvedValueOnce('fallback-response');

    await expect(
      generateContent('prompt de fallback', undefined, {
        operation: 'generate_insights_strategic',
        requestId: 'req-fallback',
      })
    ).resolves.toBe('fallback-response');

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_provider_failure',
        provider: 'gemini',
        failureCategory: 'quota_exceeded',
        requestId: 'req-fallback',
      }),
      'Gemini failed'
    );

    expect(mocks.loggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_provider_fallback_triggered',
        fromProvider: 'gemini',
        toProvider: 'openai',
        failureCategory: 'quota_exceeded',
        requestId: 'req-fallback',
      }),
      'Falling back from Gemini'
    );

    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_provider_fallback_success',
        provider: 'openai',
        requestId: 'req-fallback',
      }),
      expect.stringContaining('response received successfully')
    );
  });

  it('registra erro sem provider configurado', async () => {
    mocks.envMock.default.OPENAI_API_KEY = '';
    mocks.envMock.default.GEMINI_API_KEY = '';

    await expect(
      generateContent('prompt sem provider', undefined, { operation: 'cfo_answer', requestId: 'req-empty' })
    ).rejects.toThrow('No AI provider configured');

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_request_failed',
        failureCategory: 'no_provider_configured',
        requestId: 'req-empty',
      }),
      'No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env'
    );
  });
});
