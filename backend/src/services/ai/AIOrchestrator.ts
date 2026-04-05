/**
 * AI Orchestrator - Central router for AI requests
 * Handles:
 * - Model selection (chat lightweight, analysis heavyweight)
 * - Provider selection (primary + fallback)
 * - Retry logic with exponential backoff
 * - Metrics and observability
 * - Cost optimization
 */

import logger from '../../config/logger';
import { IAIProvider } from './IAIProvider';
import {
  AIResponse,
  AIRequestOptions,
  GenerateContentRequest,
  AIProvider as AIProviderType,
  AIMetrics,
} from './types';
import { AppError } from '../../middleware/errorHandler';

export interface OrchestratorConfig {
  primaryProvider: AIProviderType;
  fallbackProvider?: AIProviderType;
  maxRetries: number;
  retryDelayMs: number;
  enableMetrics: boolean;
}

export class AIOrchestrator {
  private providers: Map<string, IAIProvider>;
  private config: OrchestratorConfig;
  private metrics: Map<string, AIMetrics[]> = new Map(); // per provider

  constructor(config: OrchestratorConfig, providers: Map<string, IAIProvider>) {
    this.config = config;
    this.providers = providers;
  }

  /**
   * Generate content with automatic provider selection and fallback
   */
  async generateContent(
    request: GenerateContentRequest,
    options?: AIRequestOptions
  ): Promise<AIResponse> {
    const primaryProvider = this.providers.get(this.config.primaryProvider);

    if (!primaryProvider) {
      throw new AppError(
        503,
        `Primary AI provider ${this.config.primaryProvider} is not configured`
      );
    }

    // Try primary provider with retries
    try {
      logger.info('AI request: using primary provider', {
        provider: this.config.primaryProvider,
        modelType: request.model,
      });

      const response = await this.retryWithBackoff(
        () => primaryProvider.generateContent(request, options),
        this.config.maxRetries
      );

      this.recordMetric(this.config.primaryProvider, response, 'success');
      return response;
    } catch (primaryError) {
      logger.warn('Primary provider failed, attempting fallback', {
        provider: this.config.primaryProvider,
        primaryError: (primaryError as any)?.message,
      });

      // Try fallback provider if configured
      if (this.config.fallbackProvider) {
        const fallbackProvider = this.providers.get(this.config.fallbackProvider);

        if (fallbackProvider) {
          try {
            logger.info('AI request: using fallback provider', {
              provider: this.config.fallbackProvider,
              modelType: request.model,
            });

            const response = await this.retryWithBackoff(
              () => fallbackProvider.generateContent(request, options),
              this.config.maxRetries
            );

            response.wasFallback = true;
            this.recordMetric(this.config.fallbackProvider, response, 'fallback');
            return response;
          } catch (fallbackError) {
            logger.error('Both providers failed', {
              primaryProvider: this.config.primaryProvider,
              fallbackProvider: this.config.fallbackProvider,
              primaryError: (primaryError as any)?.message,
              fallbackError: (fallbackError as any)?.message,
            });

            throw new AppError(
              503,
              'All AI providers are currently unavailable. ' +
                'Our financial assistant is temporarily offline. ' +
                'Please try again in a few moments.'
            );
          }
        }
      }

      // No fallback provider - propagate error
      throw primaryError;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < retries) {
          const delayMs = this.config.retryDelayMs * Math.pow(2, attempt);
          logger.warn(`Retrying AI request (attempt ${attempt + 1}/${retries})`, {
            delayMs,
            error: (error as any)?.message,
          });

          await this.sleep(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Health check for all providers
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        logger.error(`Health check failed for ${name}`, { error });
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Get metrics for observability
   */
  getMetrics(provider?: string): AIMetrics[] {
    if (provider) {
      return this.metrics.get(provider) || [];
    }

    // Return all metrics
    const allMetrics: AIMetrics[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics;
  }

  /**
   * Record metric for observability
   */
  private recordMetric(
    providerName: string,
    response: AIResponse,
    status: 'success' | 'fallback' | 'error'
  ): void {
    if (!this.config.enableMetrics) return;

    const metric: AIMetrics = {
      provider: response.provider as AIProviderType,
      model: response.model,
      isChat: response.model.includes('3.5') || response.model.includes('flash'),
      isAnalysis: response.model.includes('4') || response.model.includes('pro'),
      isOcr: response.model.includes('vision'),
      tokensUsed: response.tokensUsed || 0,
      latencyMs: response.latencyMs || 0,
      status,
    };

    if (!this.metrics.has(providerName)) {
      this.metrics.set(providerName, []);
    }

    this.metrics.get(providerName)!.push(metric);

    // Keep only last 1000 metrics per provider
    const providerMetrics = this.metrics.get(providerName)!;
    if (providerMetrics.length > 1000) {
      providerMetrics.splice(0, providerMetrics.length - 1000);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default AIOrchestrator;
