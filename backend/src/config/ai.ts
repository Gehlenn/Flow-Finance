import env from './env';
import logger from './logger';
import * as openai from './openai';
import * as gemini from './gemini';

/**
 * AI Provider Wrapper with automatic fallback
 * Tries OpenAI first, falls back to Gemini if OpenAI fails
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

  // Try OpenAI first if available
  if (hasOpenAI) {
    try {
      logger.info({ model: env.OPENAI_MODEL }, 'Attempting OpenAI request');
      return await openai.generateContent(prompt, options);
    } catch (error: any) {
      logger.error({
        provider: 'OpenAI',
        error: error?.message || String(error),
        status: error?.status,
        hasGemini,
      }, 'OpenAI failed');
      
      // If quota exceeded (429) or model unavailable (404), try Gemini fallback
      if (hasGemini && (error.status === 429 || error.status === 404)) {
        logger.warn({ error: error.message, status: error.status }, 'OpenAI failed with recoverable error, falling back to Gemini');
        try {
          logger.info({ model: env.GEMINI_MODEL }, 'Attempting Gemini fallback');
          return await gemini.generateContent(prompt, options);
        } catch (geminiError: any) {
          logger.error({
            provider: 'Gemini',
            error: geminiError?.message || String(geminiError),
            originalOpenAIError: error?.message,
          }, 'Gemini fallback also failed');
          throw geminiError;
        }
      }
      // For other errors, throw immediately
      throw error;
    }
  }

  // Use Gemini as primary if OpenAI not configured
  if (hasGemini) {
    try {
      logger.info({ model: env.GEMINI_MODEL }, 'Using Gemini as primary AI provider');
      return await gemini.generateContent(prompt, options);
    } catch (error: any) {
      logger.error({
        provider: 'Gemini',
        error: error?.message || String(error),
      }, 'Gemini primary request failed');
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
