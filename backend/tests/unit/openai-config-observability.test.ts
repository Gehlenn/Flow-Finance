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

  return { loggerMock, envMock };
});

vi.mock('../../src/config/logger', () => ({
  default: mocks.loggerMock,
}));

vi.mock('../../src/config/env', () => mocks.envMock);

import { initOpenAI } from '../../src/config/openai';

describe('openai config observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.envMock.default.OPENAI_API_KEY = 'openai-key';
    mocks.envMock.default.OPENAI_MODEL = 'gpt-4o-mini';
    mocks.envMock.default.OPENAI_MAX_TOKENS = '4096';
  });

  it('registra erro contextual quando a OPENAI_API_KEY nao esta configurada', () => {
    mocks.envMock.default.OPENAI_API_KEY = '';

    expect(() => initOpenAI()).toThrow('OPENAI_API_KEY is not set');

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        hasApiKey: false,
        model: 'gpt-4o-mini',
        fallback: 'openai-api-key-missing',
      }),
      'OpenAI API key is missing'
    );
  });
});
