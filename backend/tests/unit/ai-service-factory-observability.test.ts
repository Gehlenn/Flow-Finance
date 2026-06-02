import { describe, expect, it, vi } from 'vitest';

const { loggerInfo, loggerError, loggerWarn, OpenAIProviderMock, GeminiProviderMock } = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  OpenAIProviderMock: class {
    constructor() {
      throw new Error('openai init failed');
    }
  },
  GeminiProviderMock: class {
    constructor() {
      throw new Error('gemini init failed');
    }
  },
}));

vi.mock('../../src/config/env', () => ({
  default: {
    OPENAI_API_KEY: 'openai-key',
    GEMINI_API_KEY: 'gemini-key',
    AI_TIMEOUT_MS: '30000',
    AI_MAX_RETRIES: '2',
    AI_PRIMARY_PROVIDER: 'gemini',
    AI_FALLBACK_PROVIDER: 'openai',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    info: loggerInfo,
    error: loggerError,
    warn: loggerWarn,
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/featureFlags/featureFlagService', () => ({
  default: {
    isEnabled: vi.fn(() => true),
  },
}));

vi.mock('../../src/services/ai/OpenAIProvider', () => ({
  default: OpenAIProviderMock,
}));

vi.mock('../../src/services/ai/GeminiProvider', () => ({
  default: GeminiProviderMock,
}));

import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';

describe('AIServiceFactory observability', () => {
  it('logs contextual data when provider initialization fails', () => {
    expect(() => AIServiceFactory.createProviders()).toThrow(
      'No AI providers configured. Please set OPENAI_API_KEY or GEMINI_API_KEY environment variables.'
    );

    expect(loggerError).toHaveBeenCalledWith(
      'Failed to initialize OpenAI provider',
      expect.objectContaining({
        provider: 'openai',
        error: 'openai init failed',
        errorType: 'Error',
        fallback: 'openai-provider-unavailable',
      }),
    );
    expect(loggerError).toHaveBeenCalledWith(
      'Failed to initialize Gemini provider',
      expect.objectContaining({
        provider: 'gemini',
        error: 'gemini init failed',
        errorType: 'Error',
        fallback: 'gemini-provider-unavailable',
      }),
    );
  });
});
