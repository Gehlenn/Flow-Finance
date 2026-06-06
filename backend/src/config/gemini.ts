import { GoogleGenerativeAI, ResponseSchema } from '@google/generative-ai';
import env from './env';
import logger from './logger';
import type { AIProviderResponse } from './ai';

let genAI: GoogleGenerativeAI | null = null;

export function initGemini(): GoogleGenerativeAI {
  if (genAI) return genAI;

  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  logger.info('Gemini API initialized');
  return genAI;
}

export function getGemini(): GoogleGenerativeAI {
  if (!genAI) {
    return initGemini();
  }
  return genAI;
}

function getCandidateModels(): string[] {
  const models = [
    env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-pro-latest',
  ];

  // Keep order, remove empty and duplicate values.
  return Array.from(new Set(models.filter(Boolean)));
}

function isModelNotFoundError(error: unknown): boolean {
  const status = error && typeof error === 'object' && 'status' in error
    ? (error as { status?: unknown }).status
    : undefined;
  const message = String(
    error && typeof error === 'object' && 'message' in error
      ? (error as { message?: unknown }).message
      : '',
  ).toLowerCase();
  return status === 404 || message.includes('not found') || message.includes('is not found');
}

export async function generateContent(
  prompt: string,
  config?: {
    responseMimeType?: string;
    responseSchema?: ResponseSchema;
  }
): Promise<AIProviderResponse> {
  const client = getGemini();
  const candidates = getCandidateModels();
  let lastError: unknown;

  for (const modelName of candidates) {
    try {
      const startTime = Date.now();
      logger.debug({ promptLength: prompt.length, model: modelName }, 'Initializing Gemini model');
      const model = client.getGenerativeModel({ model: modelName });

      logger.debug({ model: modelName, hasConfig: !!config }, 'Sending request to Gemini');
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: config ? {
          responseMimeType: config.responseMimeType,
          responseSchema: config.responseSchema,
        } : undefined,
      });

      if (!response || !response.response) {
        throw new Error('Invalid response from Gemini API');
      }

      const result = response.response.text();
      const usageMetadata = (response.response as {
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      }).usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
      const tokensUsed = usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;
      const latencyMs = Date.now() - startTime;

      logger.info(
        {
          resultLength: result?.length || 0,
          model: modelName,
          inputTokens,
          outputTokens,
          tokensUsed,
          latencyMs,
        },
        'Gemini response received successfully',
      );
      return {
        content: result,
        provider: 'gemini',
        model: modelName,
        inputTokens,
        outputTokens,
        tokensUsed,
        latencyMs,
      };
    } catch (error: unknown) {
      lastError = error;

      if (isModelNotFoundError(error)) {
        logger.warn({
          model: modelName,
          error: error instanceof Error ? error.message : String(error),
          triedModels: candidates,
          fallback: 'gemini-model-unavailable',
        }, 'Gemini model unavailable, trying next candidate');
        continue;
      }

      logger.error({
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        geminiModel: modelName,
        triedModels: candidates,
        fallback: 'gemini-generate-content-failed',
      }, 'Gemini generateContent error');
      throw error;
    }
  }

  logger.error({
    error: lastError instanceof Error ? lastError.message : String(lastError),
    triedModels: candidates,
    fallback: 'gemini-all-candidate-models-failed',
  }, 'Gemini generateContent failed for all candidate models');
  throw lastError || new Error('Gemini model resolution failed');
}

export async function countTokens(text: string): Promise<number> {
  const client = getGemini();
  const candidates = getCandidateModels();
  let lastError: unknown;

  for (const modelName of candidates) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.countTokens(text);
      return result.totalTokens;
    } catch (error: unknown) {
      lastError = error;
      if (isModelNotFoundError(error)) {
        logger.warn({
          model: modelName,
          triedModels: candidates,
          fallback: 'gemini-token-count-model-unavailable',
        }, 'Gemini token-count model unavailable, trying next candidate');
        continue;
      }
      logger.error({
        error,
        model: modelName,
        triedModels: candidates,
        fallback: 'gemini-token-count-error',
      }, 'Token count error');
      throw error;
    }
  }

  logger.error({
    error: lastError instanceof Error ? lastError.message : String(lastError),
    triedModels: candidates,
    fallback: 'gemini-token-count-all-models-failed',
  }, 'Token count failed for all Gemini models');
  throw lastError || new Error('Gemini token count failed');
}
