/**
 * Google Gemini provider implementation
 * Supports Gemini 2.5, Gemini Pro, etc
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../config/logger';
import { IAIProvider } from './IAIProvider';
import { AIResponse, AIRequestOptions, GenerateContentRequest, AIProviderConfig } from './types';
import { AppError } from '../../middleware/errorHandler';

export class GeminiProvider extends IAIProvider {
  private client: GoogleGenerativeAI;
  private modelMap: Record<string, string>;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
    // Default model mapping
    this.modelMap = {
      chat: config.models.chat || 'gemini-2.5-flash',
      analysis: config.models.analysis || 'gemini-2.5-pro',
      ocr: config.models.ocr || 'gemini-2.5-pro-vision', // vision capable
    };
  }

  async generateContent(
    request: GenerateContentRequest,
    options?: AIRequestOptions
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const modelName = this.modelMap[request.model] || this.modelMap.chat;
    const temperature = options?.temperature ?? 0.7;

    try {
      const model = this.client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: options?.maxTokens || 2000,
          temperature,
        },
      });

      const systemPrompt = this.formatSystemPrompt(request.systemPrompt);
      const response = await Promise.race([
        model.generateContent([
          systemPrompt,
          request.userMessage,
        ]),
        this.timeoutPromise(options?.timeout || 30000),
      ]);

      const latencyMs = Date.now() - startTime;
      const content = typeof response === 'object' && 'response' in response
        ? response.response.text()
        : '';

      logger.info('Gemini request succeeded', {
        provider: 'gemini',
        model: modelName,
        modelType: request.model,
        latencyMs,
      });

      return {
        content,
        provider: 'gemini',
        model: modelName,
        latencyMs,
        wasFallback: false,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = error?.message || 'Unknown Gemini error';

      logger.error('Gemini request failed', {
        provider: 'gemini',
        model: modelName,
        error: errorMsg,
        latencyMs,
      });

      throw new AppError(
        503,
        `Gemini provider error: ${errorMsg}. ` +
          'The AI service is temporarily unavailable. Please try again later.'
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.modelMap.chat });
      // Test with a simple prompt
      await model.generateContent('ping');
      return true;
    } catch (error) {
      logger.error('Gemini health check failed', { provider: 'gemini' });
      return false;
    }
  }

  private formatSystemPrompt(prompt: string): string {
    // Gemini works better with system prompt as part of content
    return `<system_prompt>${prompt}</system_prompt>`;
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini request timeout after ${ms}ms`)),
        ms
      )
    );
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Gemini pricing: free tier, but estimate for reference
    const inputCost = this.config.costPerMillion?.input || 0.00075; // $0.75 per 1M tokens
    const outputCost = this.config.costPerMillion?.output || 0.003; // $3 per 1M tokens

    return (inputTokens / 1_000_000) * inputCost + (outputTokens / 1_000_000) * outputCost;
  }
}

export default GeminiProvider;
