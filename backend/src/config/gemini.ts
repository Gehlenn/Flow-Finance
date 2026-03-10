import { GoogleGenerativeAI, ResponseSchema } from '@google/generative-ai';
import env from './env';
import logger from './logger';

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
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-8b-latest',
  ];

  // Keep order, remove empty and duplicate values.
  return Array.from(new Set(models.filter(Boolean)));
}

function isModelNotFoundError(error: any): boolean {
  const status = error?.status;
  const message = String(error?.message || '').toLowerCase();
  return status === 404 || message.includes('not found') || message.includes('is not found');
}

export async function generateContent(
  prompt: string,
  config?: {
    responseMimeType?: string;
    responseSchema?: ResponseSchema;
  }
): Promise<string> {
  const client = getGemini();
  const candidates = getCandidateModels();
  let lastError: any;

  for (const modelName of candidates) {
    try {
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
      logger.info({ resultLength: result?.length || 0, model: modelName }, 'Gemini response received successfully');
      return result;
    } catch (error: any) {
      lastError = error;

      if (isModelNotFoundError(error)) {
        logger.warn({ model: modelName, error: error?.message || String(error) }, 'Gemini model unavailable, trying next candidate');
        continue;
      }

      logger.error({
        error: error?.message || String(error),
        errorType: error?.constructor?.name,
        stack: error?.stack,
        geminiModel: modelName,
      }, 'Gemini generateContent error');
      throw error;
    }
  }

  logger.error({
    error: lastError?.message || String(lastError),
    triedModels: candidates,
  }, 'Gemini generateContent failed for all candidate models');
  throw lastError || new Error('Gemini model resolution failed');
}

export async function countTokens(text: string): Promise<number> {
  const client = getGemini();
  const candidates = getCandidateModels();
  let lastError: any;

  for (const modelName of candidates) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.countTokens(text);
      return result.totalTokens;
    } catch (error: any) {
      lastError = error;
      if (isModelNotFoundError(error)) {
        logger.warn({ model: modelName }, 'Gemini token-count model unavailable, trying next candidate');
        continue;
      }
      logger.error({ error, model: modelName }, 'Token count error');
      throw error;
    }
  }

  logger.error({ error: lastError, triedModels: candidates }, 'Token count failed for all Gemini models');
  throw lastError || new Error('Gemini token count failed');
}
