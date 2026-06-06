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
      OPENAI_MODEL: 'gpt-4o-mini',
      OPENAI_MAX_TOKENS: '4096',
    },
  };

  const createMock = vi.fn();
  const clientMock = {
    chat: {
      completions: {
        create: createMock,
      },
    },
  };

  const openaiCtorMock = vi.fn(function MockOpenAI(this: unknown) {
    return clientMock;
  });

  return { loggerMock, envMock, createMock, clientMock, openaiCtorMock };
});

vi.mock('../../src/config/logger', () => ({
  default: mocks.loggerMock,
}));

vi.mock('../../src/config/env', () => mocks.envMock);

vi.mock('openai', () => ({
  default: mocks.openaiCtorMock,
}));

describe('openai config observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.envMock.default.OPENAI_API_KEY = 'openai-key';
    mocks.envMock.default.OPENAI_MODEL = 'gpt-4o-mini';
    mocks.envMock.default.OPENAI_MAX_TOKENS = '4096';
  });

  it('registra erro contextual quando a OPENAI_API_KEY nao esta configurada', async () => {
    mocks.envMock.default.OPENAI_API_KEY = '';

    const { initOpenAI } = await import('../../src/config/openai');

    expect(() => initOpenAI()).toThrow('OPENAI_API_KEY is not set');

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        hasApiKey: false,
        model: 'gpt-4o-mini',
        fallback: 'openai-api-key-missing',
      }),
      'OpenAI API key is missing',
    );
  });

  it('propagates token usage and cost-ready metadata for a real response', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 1000,
        total_tokens: 2000,
      },
    });

    const { generateContent } = await import('../../src/config/openai');

    await expect(generateContent('prompt de teste', { responseMimeType: 'application/json' })).resolves.toEqual(
      expect.objectContaining({
        content: '{"ok":true}',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 1000,
        tokensUsed: 2000,
      }),
    );

    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        resultLength: 11,
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 1000,
        tokensUsed: 2000,
      }),
      'OpenAI response received successfully',
    );
  });
});
