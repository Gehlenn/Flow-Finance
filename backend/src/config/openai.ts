import OpenAI from 'openai';
import env from './env';
import logger from './logger';
import type { AIProviderResponse } from './aiTypes';

let client: OpenAI | null = null;

export function initOpenAI(): OpenAI {
  if (client) return client;

  if (!env.OPENAI_API_KEY) {
    logger.error(
      {
        hasApiKey: false,
        model: env.OPENAI_MODEL,
        fallback: 'openai-api-key-missing',
      },
      'OpenAI API key is missing'
    );
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
  options?: { responseMimeType?: string; responseSchema?: unknown }
): Promise<AIProviderResponse> {
  try {
    const startTime = Date.now();
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
    const latencyMs = Date.now() - startTime;
    const inputTokens = resp.usage?.prompt_tokens ?? 0;
    const outputTokens = resp.usage?.completion_tokens ?? 0;
    const tokensUsed = resp.usage?.total_tokens ?? inputTokens + outputTokens;

    logger.info(
      {
        resultLength: content.length,
        model: env.OPENAI_MODEL,
        inputTokens,
        outputTokens,
        tokensUsed,
        latencyMs,
      },
      'OpenAI response received successfully'
    );
    return {
      content,
      provider: 'openai',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      inputTokens,
      outputTokens,
      tokensUsed,
      latencyMs,
    };
  } catch (error: unknown) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      status: error && typeof error === 'object' && 'status' in error ? (error as { status?: unknown }).status : undefined,
      code: error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined,
      type: error && typeof error === 'object' && 'type' in error ? (error as { type?: unknown }).type : undefined,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      model: env.OPENAI_MODEL,
      promptLength: prompt.length,
      maxTokens: parseInt(env.OPENAI_MAX_TOKENS || '4096', 10),
      fallback: 'openai-generate-content-failed',
    }, 'OpenAI generateContent error');
    throw error;
  }
}

// crude token count using OpenAI utility
export function estimateTokens(text: string): number {
  // fallback if API doesn't provide count
  return Math.ceil(text.length / 4);
}
