/**
 * AI Service Factory
 * Creates and configures providers and orchestrator
 * Reads from environment variables and feature flags
 */

import env from '../../config/env';
import FeatureFlagService from '../featureFlags/featureFlagService';
import { Feature } from '../featureFlags/types';
import logger from '../../config/logger';
import { IAIProvider } from './IAIProvider';
import OpenAIProvider from './OpenAIProvider';
import GeminiProvider from './GeminiProvider';
import AIOrchestrator, { OrchestratorConfig } from './AIOrchestrator';
import { AIProviderConfig, AIProvider as AIProviderType } from './types';

export class AIServiceFactory {
  /**
   * Create and initialize AI providers based on configuration
   */
  static createProviders(): Map<string, IAIProvider> {
    const providers = new Map<string, IAIProvider>();

    // OpenAI provider
    if (env.OPENAI_API_KEY && FeatureFlagService.isEnabled(Feature.AI_CHAT)) {
      try {
        const openaiConfig: AIProviderConfig = {
          name: 'openai',
          apiKey: env.OPENAI_API_KEY,
          enabled: true,
          models: {
            chat: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
            analysis: env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini',
            ocr: env.OPENAI_OCR_MODEL || 'gpt-4o-mini',
          },
          timeout: parseInt(env.AI_TIMEOUT_MS || '30000', 10),
          maxRetries: parseInt(env.AI_MAX_RETRIES || '2', 10),
          costPerMillion: {
            input: 0.00015, // $0.15 per 1M input tokens (gpt-4o-mini)
            output: 0.0006,  // $0.60 per 1M output tokens (gpt-4o-mini)
          },
        };

        providers.set('openai', new OpenAIProvider(openaiConfig));
        logger.info('OpenAI provider initialized', {
          models: openaiConfig.models,
        });
      } catch (error) {
        logger.error('Failed to initialize OpenAI provider', {
          error: (error as any)?.message,
        });
      }
    }

    // Gemini provider
    if (env.GEMINI_API_KEY && FeatureFlagService.isEnabled(Feature.AI_ANALYSIS)) {
      try {
        const geminiConfig: AIProviderConfig = {
          name: 'gemini',
          apiKey: env.GEMINI_API_KEY,
          enabled: true,
          models: {
            chat: env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
            analysis: env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-pro',
            ocr: env.GEMINI_OCR_MODEL || 'gemini-2.5-pro-vision',
          },
          timeout: parseInt(env.AI_TIMEOUT_MS || '30000', 10),
          maxRetries: parseInt(env.AI_MAX_RETRIES || '2', 10),
          costPerMillion: {
            input: 0.00075, // Gemini is cheaper
            output: 0.003,
          },
        };

        providers.set('gemini', new GeminiProvider(geminiConfig));
        logger.info('Gemini provider initialized', {
          models: geminiConfig.models,
        });
      } catch (error) {
        logger.error('Failed to initialize Gemini provider', {
          error: (error as any)?.message,
        });
      }
    }

    if (providers.size === 0) {
      throw new Error(
        'No AI providers configured. ' +
          'Please set OPENAI_API_KEY or GEMINI_API_KEY environment variables.'
      );
    }

    return providers;
  }

  /**
   * Create orchestrator with configured providers
   */
  static createOrchestrator(providers: Map<string, IAIProvider>): AIOrchestrator {
    const primaryProvider = (env.AI_PRIMARY_PROVIDER || 'gemini') as AIProviderType;
    const fallbackProvider = (env.AI_FALLBACK_PROVIDER || 'openai') as AIProviderType;

    // Validate that primary provider is available
    if (!providers.has(primaryProvider)) {
      logger.warn(`Primary provider ${primaryProvider} not available, using first available`, {
        primaryProvider,
        availableProviders: Array.from(providers.keys()),
      });
    }

    const config: OrchestratorConfig = {
      primaryProvider: providers.has(primaryProvider) ? primaryProvider : Array.from(providers.keys())[0] as AIProviderType,
      fallbackProvider: providers.has(fallbackProvider) ? fallbackProvider : undefined,
      maxRetries: parseInt(env.AI_MAX_RETRIES || '2', 10),
      retryDelayMs: parseInt(env.AI_RETRY_DELAY_MS || '500', 10),
      enableMetrics: env.NODE_ENV === 'production',
    };

    logger.info('AI Orchestrator configured', {
      primaryProvider: config.primaryProvider,
      fallbackProvider: config.fallbackProvider || 'none',
      maxRetries: config.maxRetries,
    });

    return new AIOrchestrator(config, providers);
  }

  /**
   * Create and initialize the complete AI service
   */
  static createAIService(): AIOrchestrator {
    const providers = this.createProviders();
    const orchestrator = this.createOrchestrator(providers);
    return orchestrator;
  }
}

export default AIServiceFactory;
