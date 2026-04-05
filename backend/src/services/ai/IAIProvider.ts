/**
 * Abstract interface for AI providers
 * All providers must implement this contract
 */

import { AIResponse, AIRequestOptions, GenerateContentRequest, AIProviderConfig } from './types';

export abstract class IAIProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Generate content from an AI model
   * Must handle retries, timeouts, and fallback internally
   */
  abstract generateContent(request: GenerateContentRequest, options?: AIRequestOptions): Promise<AIResponse>;

  /**
   * Health check - verify API key validity and service availability
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get provider name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get estimated cost for a request (if available)
   */
  estimateCost?(inputTokens: number, outputTokens: number): number;
}

export default IAIProvider;
