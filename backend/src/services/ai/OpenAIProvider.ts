/**
 * OpenAI provider implementation
 * Supports GPT-4, GPT-4-turbo, GPT-3.5
 */

import { OpenAI } from 'openai';
import logger from '../../config/logger';
import { IAIProvider } from './IAIProvider';
import { AIResponse, AIRequestOptions, GenerateContentRequest, AIProviderConfig } from './types';
import { AppError } from '../../middleware/errorHandler';

export class OpenAIProvider extends IAIProvider {
  private client: OpenAI;
  private modelMap: Record<string, string>;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new OpenAI({ apiKey: config.apiKey });
    // Default model mapping
    this.modelMap = {
      chat: config.models.chat || 'gpt-4-turbo',
      analysis: config.models.analysis || 'gpt-4-turbo',
      ocr: config.models.ocr || 'gpt-4-turbo',
    };
  }

  async generateContent(
    request: GenerateContentRequest,
    options?: AIRequestOptions
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const modelName = this.modelMap[request.model] || this.modelMap.chat;
    const maxTokens = options?.maxTokens || 2000;
    const temperature = options?.temperature ?? 0.7;
    const timeoutMs = options?.timeout || 30000;

    try {
      // Use Promise.race to implement timeout
      const response = await Promise.race([
        this.client.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userMessage },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
        this.timeoutPromise(timeoutMs),
      ]);

      const latencyMs = Date.now() - startTime;
      const tokensUsed = response.usage?.total_tokens || 0;

      logger.info('OpenAI request succeeded', {
        provider: 'openai',
        model: modelName,
        modelType: request.model,
        tokensUsed,
        latencyMs,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        provider: 'openai',
        model: modelName,
        tokensUsed,
        latencyMs,
        wasFallback: false,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = error?.message || 'Unknown OpenAI error';
      
      logger.error('OpenAI request failed', {
        provider: 'openai',
        model: modelName,
        error: errorMsg,
        latencyMs,
      });

      throw new AppError(
        503,
        `OpenAI provider error: ${errorMsg}. ` +
          'The AI service is temporarily unavailable. Please try again later.'
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check: list models
      const models = await this.client.models.list();
      return !!models.data;
    } catch (error) {
      logger.error('OpenAI health check failed', { provider: 'openai' });
      return false;
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = this.config.costPerMillion?.input || 0.003; // $3 per 1M input tokens
    const outputCost = this.config.costPerMillion?.output || 0.006; // $6 per 1M output tokens

    return (inputTokens / 1_000_000) * inputCost + (outputTokens / 1_000_000) * outputCost;
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`OpenAI request timeout after ${ms}ms`)),
        ms
      )
    );
  }
}

export default OpenAIProvider;
