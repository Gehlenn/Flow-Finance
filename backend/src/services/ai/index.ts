/**
 * AI Service exports and initialization
 */

import AIServiceFactory from './AIServiceFactory';
import AIOrchestrator from './AIOrchestrator';
import logger from '../../config/logger';

let orchestratorInstance: AIOrchestrator | null = null;

/**
 * Initialize and get the AI orchestrator singleton
 */
export function initializeAIService(): AIOrchestrator {
  if (orchestratorInstance) {
    return orchestratorInstance;
  }

  try {
    orchestratorInstance = AIServiceFactory.createAIService();
    logger.info('AI Service initialized successfully');
    return orchestratorInstance;
  } catch (error) {
    logger.error('Failed to initialize AI Service', {
      error: (error as any)?.message,
    });
    throw error;
  }
}

/**
 * Get the AI orchestrator singleton (must call initializeAIService first)
 */
export function getAIService(): AIOrchestrator {
  if (!orchestratorInstance) {
    throw new Error(
      'AI Service not initialized. Call initializeAIService() first.'
    );
  }
  return orchestratorInstance;
}

// Export all types and classes
export { AIServiceFactory };
export { AIOrchestrator } from './AIOrchestrator';
export { IAIProvider } from './IAIProvider';
export { OpenAIProvider } from './OpenAIProvider';
export { GeminiProvider } from './GeminiProvider';
export type {
  AIModel,
  AIProvider as AIProviderType,
  AIRequestOptions,
  AIResponse,
  AIProviderConfig,
  GenerateContentRequest,
  AIMetrics,
} from './types';
