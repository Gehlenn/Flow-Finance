import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  envMock: {
    default: {
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_MODEL: 'gemini-2.5-flash',
    },
  },
  generateContentMock: vi.fn(),
  countTokensMock: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: mocks.loggerMock,
}));

vi.mock('../../src/config/env', () => mocks.envMock);

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: function MockGoogleGenerativeAI() {
    return {
    getGenerativeModel: vi.fn(({ model }: { model: string }) => {
      if (model === 'gemini-2.5-flash') {
        return {
          generateContent: mocks.generateContentMock,
          countTokens: mocks.countTokensMock,
        };
      }

      return {
        generateContent: mocks.generateContentMock,
        countTokens: mocks.countTokensMock,
      };
    }),
      };
  },
}));

describe('config/gemini observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateContentMock.mockReset();
    mocks.countTokensMock.mockReset();
  });

  it('registra contexto quando o modelo primario fica indisponivel e o fallback falha', async () => {
    const modelUnavailable = Object.assign(new Error('model not found'), { status: 404 });
    mocks.generateContentMock.mockRejectedValueOnce(modelUnavailable);
    mocks.generateContentMock.mockRejectedValueOnce(new Error('gemini fallback failed'));

    const { generateContent } = await import('../../src/config/gemini');

    await expect(generateContent('prompt de teste')).rejects.toThrow('gemini fallback failed');

    expect(mocks.loggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        triedModels: expect.arrayContaining(['gemini-2.5-flash']),
        fallback: 'gemini-model-unavailable',
      }),
      'Gemini model unavailable, trying next candidate',
    );

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'gemini fallback failed',
        geminiModel: expect.stringMatching(/^gemini-/),
        fallback: 'gemini-generate-content-failed',
      }),
      'Gemini generateContent error',
    );
  });

  it('propagates token usage and cost-ready metadata for a real response', async () => {
    mocks.generateContentMock.mockResolvedValueOnce({
      response: {
        text: () => '{"ok":true}',
        usageMetadata: {
          promptTokenCount: 1000,
          candidatesTokenCount: 1000,
          totalTokenCount: 2000,
        },
      },
    });

    const { generateContent } = await import('../../src/config/gemini');

    await expect(generateContent('prompt de teste')).resolves.toEqual(
      expect.objectContaining({
        content: '{"ok":true}',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        inputTokens: 1000,
        outputTokens: 1000,
        tokensUsed: 2000,
      }),
    );

    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        resultLength: 11,
        model: 'gemini-2.5-flash',
        inputTokens: 1000,
        outputTokens: 1000,
        tokensUsed: 2000,
      }),
      'Gemini response received successfully',
    );
  });

  it('registra contexto quando countTokens falha em todos os modelos', async () => {
    const modelUnavailable = Object.assign(new Error('model not found'), { status: 404 });
    mocks.countTokensMock.mockRejectedValueOnce(modelUnavailable);
    mocks.countTokensMock.mockRejectedValueOnce(new Error('count failed'));

    const { countTokens } = await import('../../src/config/gemini');

    await expect(countTokens('texto de teste')).rejects.toThrow('count failed');

    expect(mocks.loggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        triedModels: expect.arrayContaining(['gemini-2.5-flash']),
        fallback: 'gemini-token-count-model-unavailable',
      }),
      'Gemini token-count model unavailable, trying next candidate',
    );

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        fallback: 'gemini-token-count-error',
      }),
      'Token count error',
    );
  });
});


