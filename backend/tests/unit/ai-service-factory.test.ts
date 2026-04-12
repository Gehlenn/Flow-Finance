import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/featureFlags/featureFlagService', () => ({
  default: {
    isEnabled: vi.fn(() => true),
  },
}));

vi.mock('../../src/services/ai/OpenAIProvider', () => ({
  default: class OpenAIProvider {
    constructor(public config: unknown) {}
  },
}));

vi.mock('../../src/services/ai/GeminiProvider', () => ({
  default: class GeminiProvider {
    constructor(public config: unknown) {}
  },
}));

vi.mock('../../src/services/ai/AIOrchestrator', () => ({
  default: class AIOrchestrator {
    config: unknown;
    providers: unknown;

    constructor(config: unknown, providers: unknown) {
      this.config = config;
      this.providers = providers;
    }
  },
}));

async function loadFactoryWithEnv(
  overrides: Partial<{
    AI_PRIMARY_PROVIDER: 'gemini' | 'openai';
    AI_FALLBACK_PROVIDER: 'gemini' | 'openai';
    NODE_ENV: string;
    AI_MAX_RETRIES: string;
    AI_RETRY_DELAY_MS: string;
  }> = {},
) {
  vi.resetModules();

  vi.doMock('../../src/config/env', () => ({
    default: {
      AI_PRIMARY_PROVIDER: overrides.AI_PRIMARY_PROVIDER ?? 'gemini',
      AI_FALLBACK_PROVIDER: overrides.AI_FALLBACK_PROVIDER ?? 'openai',
      NODE_ENV: overrides.NODE_ENV ?? 'test',
      AI_MAX_RETRIES: overrides.AI_MAX_RETRIES ?? '2',
      AI_RETRY_DELAY_MS: overrides.AI_RETRY_DELAY_MS ?? '500',
      OPENAI_API_KEY: 'test-openai-key',
      GEMINI_API_KEY: 'test-gemini-key',
    },
  }));

  return import('../../src/services/ai/AIServiceFactory');
}

describe('AIServiceFactory defaults', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('defaults to Gemini primary and OpenAI fallback', async () => {
    const { AIServiceFactory } = await loadFactoryWithEnv();
    const providers = new Map<string, any>();
    providers.set('gemini', { generateContent: vi.fn() });
    providers.set('openai', { generateContent: vi.fn() });

    const orchestrator = AIServiceFactory.createOrchestrator(providers as any);

    expect((orchestrator as any).config.primaryProvider).toBe('gemini');
    expect((orchestrator as any).config.fallbackProvider).toBe('openai');
  });

  it('falls back to the first available provider when configured primary is unavailable', async () => {
    const { AIServiceFactory } = await loadFactoryWithEnv({
      AI_PRIMARY_PROVIDER: 'gemini',
      AI_FALLBACK_PROVIDER: 'openai',
    });
    const providers = new Map<string, any>();
    providers.set('openai', { generateContent: vi.fn() });

    const orchestrator = AIServiceFactory.createOrchestrator(providers as any);

    expect((orchestrator as any).config.primaryProvider).toBe('openai');
    expect((orchestrator as any).config.fallbackProvider).toBe('openai');
  });
});
