import { describe, expect, it, vi } from 'vitest';

const loggerError = vi.fn();
const loggerInfo = vi.fn();
const createAIService = vi.fn();

vi.mock('../../src/config/logger', () => ({
  default: {
    error: loggerError,
    info: loggerInfo,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/ai/AIServiceFactory', () => ({
  default: {
    createAIService,
  },
}));

import { initializeAIService } from '../../src/services/ai';

describe('AI service initialization observability', () => {
  it('logs contextual data when AI service initialization fails', () => {
    createAIService.mockImplementationOnce(() => {
      throw new Error('factory offline');
    });

    expect(() => initializeAIService()).toThrow('factory offline');
    expect(loggerError).toHaveBeenCalledWith(
      'Failed to initialize AI Service',
      expect.objectContaining({
        error: 'factory offline',
        errorType: 'Error',
        fallback: 'ai-service-unavailable',
      }),
    );
  });
});
