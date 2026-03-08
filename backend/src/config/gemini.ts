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

export async function generateContent(
  prompt: string,
  config?: {
    responseMimeType?: string;
    responseSchema?: ResponseSchema;
  }
): Promise<string> {
  try {
    const client = getGemini();
    const model = client.getGenerativeModel({ model: env.GEMINI_MODEL });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config ? {
        responseMimeType: config.responseMimeType,
        responseSchema: config.responseSchema,
      } : undefined,
    });

    const result = response.response.text();
    return result;
  } catch (error) {
    logger.error({ error }, 'Gemini API error');
    throw error;
  }
}

export async function countTokens(text: string): Promise<number> {
  try {
    const client = getGemini();
    const model = client.getGenerativeModel({ model: env.GEMINI_MODEL });

    const result = await model.countTokens(text);
    return result.totalTokens;
  } catch (error) {
    logger.error({ error }, 'Token count error');
    throw error;
  }
}
