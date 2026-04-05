import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AIOrchestrator, { OrchestratorConfig } from '../../src/services/ai/AIOrchestrator';
import { IAIProvider } from '../../src/services/ai/IAIProvider';
import { AIResponse, AIProviderConfig, GenerateContentRequest } from '../../src/services/ai/types';

// Mock provider for testing
class MockAIProvider extends IAIProvider {
  private shouldFail = false;
  private failureCount = 0;

  setShouldFail(fail: boolean, count = 1): void {
    this.shouldFail = fail;
    this.failureCount = count;
  }

  async generateContent(request: GenerateContentRequest): Promise<AIResponse> {
    if (this.shouldFail && this.failureCount > 0) {
      this.failureCount--;
      throw new Error('Mock provider error');
    }

    return {
      content: `Mock response for ${request.model}`,
      provider: this.config.name as any,
      model: this.config.models[request.model] || 'mock-model',
      latencyMs: 100,
      wasFallback: false,
    };
  }

  async healthCheck(): Promise<boolean> {
    return !this.shouldFail;
  }
}

describe('AIOrchestrator', () => {
  let orchestrator: AIOrchestrator;
  let primaryProvider: MockAIProvider;
  let fallbackProvider: MockAIProvider;

  beforeEach(() => {
    const primaryConfig: AIProviderConfig = {
      name: 'openai',
      apiKey: 'test-key',
      enabled: true,
      models: { chat: 'gpt-4-turbo', analysis: 'gpt-4-turbo' },
      timeout: 30000,
      maxRetries: 2,
    };

    const fallbackConfig: AIProviderConfig = {
      name: 'gemini',
      apiKey: 'test-key',
      enabled: true,
      models: { chat: 'gemini-flash', analysis: 'gemini-pro' },
      timeout: 30000,
      maxRetries: 2,
    };

    primaryProvider = new MockAIProvider(primaryConfig);
    fallbackProvider = new MockAIProvider(fallbackConfig);

    const providers = new Map<string, IAIProvider>();
    providers.set('openai', primaryProvider);
    providers.set('gemini', fallbackProvider);

    const config: OrchestratorConfig = {
      primaryProvider: 'openai',
      fallbackProvider: 'gemini',
      maxRetries: 2,
      retryDelayMs: 10, // short for tests
      enableMetrics: true,
    };

    orchestrator = new AIOrchestrator(config, providers);
  });

  describe('generateContent', () => {
    it('should use primary provider on success', async () => {
      const request: GenerateContentRequest = {
        systemPrompt: 'You are helpful',
        userMessage: 'Hello',
        model: 'chat',
      };

      const response = await orchestrator.generateContent(request);

      expect(response.provider).toBe('openai');
      expect(response.content).toContain('Mock response');
    });

    it('should retry on transient failure', async () => {
      const request: GenerateContentRequest = {
        systemPrompt: 'You are helpful',
        userMessage: 'Hello',
        model: 'chat',
      };

      // Fail once, then succeed
      primaryProvider.setShouldFail(true, 1);

      const response = await orchestrator.generateContent(request);

      expect(response).toBeDefined();
      expect(response.provider).toBe('openai');
    });

    it('should fallback when primary exhausts retries', async () => {
      const request: GenerateContentRequest = {
        systemPrompt: 'You are helpful',
        userMessage: 'Hello',
        model: 'chat',
      };

      // Fail all retries on primary
      primaryProvider.setShouldFail(true, 100);

      const response = await orchestrator.generateContent(request);

      expect(response.provider).toBe('gemini');
      expect(response.wasFallback).toBe(true);
    });

    it('should throw when all providers fail', async () => {
      const request: GenerateContentRequest = {
        systemPrompt: 'You are helpful',
        userMessage: 'Hello',
        model: 'chat',
      };

      primaryProvider.setShouldFail(true, 100);
      fallbackProvider.setShouldFail(true, 100);

      await expect(orchestrator.generateContent(request)).rejects.toThrow(
        /All AI providers are currently unavailable/
      );
    });
  });

  describe('healthCheckAll', () => {
    it('should check all providers', async () => {
      const results = await orchestrator.healthCheckAll();

      expect(results).toHaveProperty('openai');
      expect(results).toHaveProperty('gemini');
      expect(results.openai).toBe(true);
      expect(results.gemini).toBe(true);
    });

    it('should mark failed providers as unhealthy', async () => {
      primaryProvider.setShouldFail(true);

      const results = await orchestrator.healthCheckAll();

      expect(results.openai).toBe(false);
      expect(results.gemini).toBe(true);
    });
  });

  describe('metrics collection', () => {
    it('should record successful requests', async () => {
      const request: GenerateContentRequest = {
        systemPrompt: 'You are helpful',
        userMessage: 'Hello',
        model: 'chat',
      };

      await orchestrator.generateContent(request);

      const metrics = orchestrator.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].status).toBe('success');
    });

    it('should record fallback usage', async () => {
      const request: GenerateContentRequest = {
        systemPrompt: 'You are helpful',
        userMessage: 'Hello',
        model: 'chat',
      };

      primaryProvider.setShouldFail(true, 100);
      await orchestrator.generateContent(request);

      const metrics = orchestrator.getMetrics();
      const fallbackMetrics = metrics.filter((m) => m.provider === 'gemini');
      expect(fallbackMetrics.some((m) => m.status === 'fallback')).toBe(true);
    });

    it('should filter metrics by provider', async () => {
      const request: GenerateContentRequest = {
        systemPrompt: 'You are helpful',
        userMessage: 'Hello',
        model: 'chat',
      };

      await orchestrator.generateContent(request);
      const openaiMetrics = orchestrator.getMetrics('openai');

      expect(openaiMetrics.length).toBeGreaterThan(0);
      expect(openaiMetrics.every((m) => m.provider === 'openai')).toBe(true);
    });
  });

  describe('retry logic', () => {
    it('should retry with exponential backoff', async () => {
      const request: GenerateContentRequest = {
        systemPrompt: 'You are helpful',
        userMessage: 'Hello',
        model: 'chat',
      };

      primaryProvider.setShouldFail(true, 2); // fail twice

      const startTime = Date.now();
      await orchestrator.generateContent(request);
      const duration = Date.now() - startTime;

      // Should have retried at least once with delay
      expect(duration).toBeGreaterThanOrEqual(10); // retryDelayMs = 10
    });
  });
});
