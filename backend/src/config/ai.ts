import env from './env';
import logger from './logger';
import * as openai from './openai';
import * as gemini from './gemini';

/**
 * AI Provider Wrapper with automatic fallback
 * Tries Gemini first, falls back to OpenAI when Gemini is unavailable
 */

export async function generateContent(
  prompt: string,
  options?: { responseMimeType?: string; responseSchema?: any }
): Promise<string> {
  const hasOpenAI = !!env.OPENAI_API_KEY;
  const hasGemini = !!env.GEMINI_API_KEY;

  logger.info({ hasOpenAI, hasGemini }, 'AI provider availability check');

  if (!hasOpenAI && !hasGemini) {
    const error = 'No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env';
    logger.error({}, error);
    throw new Error(error);
  }

  // Try Gemini first if available
  if (hasGemini) {
    try {
      logger.info({ model: env.GEMINI_MODEL }, 'Attempting Gemini request');
      return await gemini.generateContent(prompt, options);
    } catch (error: any) {
      logger.error({
        provider: 'Gemini',
        error: error?.message || String(error),
        status: error?.status,
        hasOpenAI,
      }, 'Gemini failed');

      // If quota exceeded (429) or model unavailable (404), try OpenAI fallback
      if (hasOpenAI && (error.status === 429 || error.status === 404)) {
        logger.warn({ error: error.message, status: error.status }, 'Gemini failed with recoverable error, falling back to OpenAI');
        try {
          logger.info({ model: env.OPENAI_MODEL }, 'Attempting OpenAI fallback');
          return await openai.generateContent(prompt, options);
        } catch (openAiError: any) {
          logger.error({
            provider: 'OpenAI',
            error: openAiError?.message || String(openAiError),
            originalGeminiError: error?.message,
          }, 'OpenAI fallback also failed');
          throw openAiError;
        }
      }
      // For other errors, throw immediately
      throw error;
    }
  }

  // Use OpenAI as primary if Gemini is not configured
  if (hasOpenAI) {
    try {
      logger.info({ model: env.OPENAI_MODEL }, 'Using OpenAI as primary AI provider');
      return await openai.generateContent(prompt, options);
    } catch (error: any) {
      logger.error({
        provider: 'OpenAI',
        error: error?.message || String(error),
      }, 'OpenAI primary request failed');
      throw error;
    }
  }

  throw new Error('Unreachable: No AI provider available');
}

export async function estimateTokens(text: string): Promise<number> {
  try {
    return await openai.estimateTokens(text);
  } catch {
    // Rough estimate: ~4 chars per token for Portuguese
    return Math.ceil(text.length / 4);
  }
}
