import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  createAIService: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/ai/AIServiceFactory', () => ({
  default: {
    createAIService: mocks.createAIService,
  },
}));

import { initializeAIService } from '../../src/services/ai';

describe('AI service initialization observability', () => {
  beforeEach(() => {
    mocks.loggerError.mockReset();
    mocks.loggerInfo.mockReset();
    mocks.createAIService.mockReset();
  });

  it('logs contextual data when AI service initialization fails', () => {
    mocks.createAIService.mockImplementationOnce(() => {
      throw new Error('factory offline');
    });

    expect(() => initializeAIService()).toThrow('factory offline');
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to initialize AI Service',
      expect.objectContaining({
        error: 'factory offline',
        errorType: 'Error',
        fallback: 'ai-service-unavailable',
      }),
    );
  });

  it('returns the singleton and logs success when initialization works', async () => {
    const fakeOrchestrator = { kind: 'orchestrator' };

    mocks.createAIService.mockReturnValueOnce(fakeOrchestrator);

    vi.resetModules();
    const { initializeAIService: initializeFreshAIService, getAIService } = await import('../../src/services/ai');

    const result = initializeFreshAIService();

    expect(result).toBe(fakeOrchestrator);
    expect(getAIService()).toBe(fakeOrchestrator);

    expect(mocks.loggerInfo).toHaveBeenCalledWith('AI Service initialized successfully');
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });
});
