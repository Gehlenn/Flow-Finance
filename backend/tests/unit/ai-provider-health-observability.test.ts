import { describe, expect, it, vi } from 'vitest';

const { loggerError } = vi.hoisted(() => ({
  loggerError: vi.fn(),
}));

vi.mock('openai', () => ({
  OpenAI: class {
    models = {
      list: vi.fn(),
    };
  },
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = vi.fn(() => ({
      generateContent: vi.fn(),
    }));
  },
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: loggerError,
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { OpenAIProvider } from '../../src/services/ai/OpenAIProvider';
import { GeminiProvider } from '../../src/services/ai/GeminiProvider';

describe('AI provider health observability', () => {
  it('logs contextual data when OpenAI health check fails', async () => {
    const provider = new OpenAIProvider({
      name: 'openai',
      apiKey: 'test-key',
      enabled: true,
      models: { chat: 'gpt-4-turbo', analysis: 'gpt-4-turbo' },
      timeout: 30000,
      maxRetries: 2,
    });

    (provider as unknown as { client: { models: { list: (...args: unknown[]) => Promise<unknown> } } }).client = {
      models: {
        list: vi.fn().mockRejectedValue(new Error('openai down')),
      },
    };

    await expect(provider.healthCheck()).resolves.toBe(false);
    expect(loggerError).toHaveBeenCalledWith(
      'OpenAI health check failed',
      expect.objectContaining({
        provider: 'openai',
        error: 'openai down',
      }),
    );
  });

  it('logs contextual data when Gemini health check fails', async () => {
    const provider = new GeminiProvider({
      name: 'gemini',
      apiKey: 'test-key',
      enabled: true,
      models: { chat: 'gemini-2.5-flash', analysis: 'gemini-2.5-pro' },
      timeout: 30000,
      maxRetries: 2,
    });

    (provider as unknown as { client: { getGenerativeModel: (...args: unknown[]) => { generateContent: (...args: unknown[]) => Promise<unknown> } } }).client = {
      getGenerativeModel: vi.fn(() => ({
        generateContent: vi.fn().mockRejectedValue(new Error('gemini down')),
      })),
    };

    await expect(provider.healthCheck()).resolves.toBe(false);
    expect(loggerError).toHaveBeenCalledWith(
      'Gemini health check failed',
      expect.objectContaining({
        provider: 'gemini',
        error: 'gemini down',
      }),
    );
  });
});
