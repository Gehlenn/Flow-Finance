import OpenAI from 'openai';
import env from './env';
import logger from './logger';

let client: OpenAI | null = null;

export function initOpenAI(): OpenAI {
  if (client) return client;

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  logger.info('OpenAI API initialized');
  return client;
}

export function getOpenAI(): OpenAI {
  if (!client) {
    return initOpenAI();
  }
  return client;
}

export async function generateContent(
  prompt: string,
  options?: { responseMimeType?: string; responseSchema?: any }
): Promise<string> {
  try {
    logger.debug({ model: env.OPENAI_MODEL, promptLength: prompt.length }, 'Initializing OpenAI client');
    const openai = getOpenAI();
    
    logger.debug({ model: env.OPENAI_MODEL, maxTokens: env.OPENAI_MAX_TOKENS }, 'Sending request to OpenAI');
    const resp = await openai.chat.completions.create({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: parseInt(env.OPENAI_MAX_TOKENS || '4096', 10),
      ...(options?.responseMimeType === 'application/json' && {
        response_format: { type: 'json_object' }
      })
    });
    
    const content = resp.choices[0]?.message?.content || '';
    logger.info({ resultLength: content.length, model: env.OPENAI_MODEL }, 'OpenAI response received successfully');
    return content;
  } catch (error: any) {
    logger.error({ 
      error: error?.message || String(error),
      status: error?.status,
      code: error?.code,
      type: error?.type,
      errorType: error?.constructor?.name,
      stack: error?.stack,
      model: env.OPENAI_MODEL,
    }, 'OpenAI generateContent error');
    throw error;
  }
}

// crude token count using OpenAI utility
export function estimateTokens(text: string): number {
  // fallback if API doesn't provide count
  return Math.ceil(text.length / 4);
}
