/**
 * Types and interfaces for AI service orchestration
 * Supports multiple providers, models, and use cases
 */

export type AIModel = 'chat' | 'analysis' | 'ocr';
export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface AIRequestOptions {
  model: AIModel; // 'chat' (lightweight), 'analysis' (heavyweight), 'ocr'
  maxTokens?: number;
  temperature?: number;
  timeout?: number; // milliseconds
  workspaceId?: string; // optional context for per-workspace AI cost monitoring
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  wasFallback?: boolean; // true if primary provider failed
}

export interface AIProviderConfig {
  name: AIProvider;
  apiKey: string;
  enabled: boolean;
  models: {
    chat?: string;      // lightweight model name
    analysis?: string;  // heavyweight model name
    ocr?: string;       // vision/ocr model name
  };
  timeout: number;      // milliseconds
  maxRetries: number;
  costPerMillion?: {
    input: number;      // $ per 1M input tokens
    output: number;     // $ per 1M output tokens
  };
}

export interface GenerateContentRequest {
  systemPrompt: string;
  userMessage: string;
  model: AIModel;
  options?: AIRequestOptions;
}

export interface AIMetrics {
  provider: AIProvider;
  model: string;
  isChat: boolean;
  isAnalysis: boolean;
  isOcr: boolean;
  tokensUsed: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  status: 'success' | 'fallback' | 'error';
  workspaceId?: string;
  estimatedCostUsd?: number;
  costEvidence?: string;
  errorType?: string;
}
