import env from './env';
import logger from './logger';
import * as openai from './openai';
import * as gemini from './gemini';
import { estimateAICost } from '../services/ai/aiCostMonitor';

/**
 * AI Provider Wrapper with automatic fallback and structured observability
 * Uses AI_PRIMARY_PROVIDER and AI_FALLBACK_PROVIDER to determine provider order.
 */

type AIRequestContext = {
  operation?: string;
  requestId?: string;
  source?: string;
  workspaceId?: string | null;
  userId?: string;
};

type AIProviderOptions = {
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
};

type AIProviderError = {
  status?: number;
  code?: string;
  message?: string;
};

export type AIProviderResponse = {
  content: string;
  provider: 'openai' | 'gemini';
  model: string;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
  latencyMs?: number;
};

export type AIResponseEnvelope = AIProviderResponse & {
  workspaceId: string | null;
  estimatedCostUsd: number;
  costEvidence: string;
};

function isAIProviderError(err: unknown): err is AIProviderError {
  return typeof err === 'object' && err !== null;
}

function categorizeError(err: unknown): string {
  if (isAIProviderError(err)) {
    if (err.status === 429 || err.code === 'rate_limit_exceeded') return 'quota_exceeded';
    if (err.status === 404) return 'model_unavailable';
    if (err.status === 401) return 'auth_failure';
  }
  return 'unknown_error';
}

async function callProvider(
  provider: string,
  prompt: string,
  options?: AIProviderOptions
): Promise<AIProviderResponse> {
  if (provider === 'gemini') {
    return gemini.generateContent(prompt, options);
  }
  return openai.generateContent(prompt, options);
}

export async function generateContent(
  prompt: string,
  options?: AIProviderOptions,
  context?: AIRequestContext
): Promise<AIResponseEnvelope> {
  const hasOpenAI = !!env.OPENAI_API_KEY;
  const hasGemini = !!env.GEMINI_API_KEY;
  const primary = env.AI_PRIMARY_PROVIDER || 'gemini';
  const fallback = env.AI_FALLBACK_PROVIDER || 'openai';

  const primaryAvailable = primary === 'gemini' ? hasGemini : hasOpenAI;
  const fallbackAvailable = fallback === 'gemini' ? hasGemini : hasOpenAI;

  const providerPlan: string[] = [];
  if (primaryAvailable) providerPlan.push(primary);
  if (fallbackAvailable && fallback !== primary) providerPlan.push(fallback);

  logger.info(
    {
      event: 'ai_request_started',
      operation: context?.operation,
      requestId: context?.requestId,
      workspaceId: context?.workspaceId ?? null,
      source: context?.source,
      responseMimeType: options?.responseMimeType,
      providerPlan,
    },
    'AI request started',
  );

  if (!hasOpenAI && !hasGemini) {
    const msg = 'No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env';
    logger.error(
      { event: 'ai_request_failed', failureCategory: 'no_provider_configured', requestId: context?.requestId },
      msg,
    );
    throw new Error(msg);
  }

  if (primaryAvailable) {
    try {
      const result = await callProvider(primary, prompt, options);
      const costEstimate = estimateAICost({
        workspaceId: context?.workspaceId ?? null,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        tokensUsed: result.tokensUsed,
      });
      logger.info(
        {
          event: 'ai_provider_success',
          provider: primary,
          operation: context?.operation,
          requestId: context?.requestId,
          workspaceId: context?.workspaceId ?? null,
          model: result.model,
          tokensUsed: result.tokensUsed,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd: costEstimate.estimatedCostUsd,
          costEvidence: costEstimate.evidence,
        },
        `${primary} response received successfully`,
      );
      logger.info(
        {
          event: 'ai_response_cost_estimated',
          provider: result.provider,
          model: result.model,
          operation: context?.operation,
          requestId: context?.requestId,
          workspaceId: context?.workspaceId ?? null,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          tokensUsed: result.tokensUsed,
          estimatedCostUsd: costEstimate.estimatedCostUsd,
          costEvidence: costEstimate.evidence,
        },
        'AI response cost estimated',
      );
      const envelope = {
        ...result,
        workspaceId: context?.workspaceId ?? null,
        estimatedCostUsd: costEstimate.estimatedCostUsd,
        costEvidence: costEstimate.evidence,
      };
      return envelope;
    } catch (err: unknown) {
      const failureCategory = categorizeError(err);
      const errObj = isAIProviderError(err) ? err : {};
      logger.error(
        { event: 'ai_provider_failure', provider: primary, failureCategory, requestId: context?.requestId, error: errObj.message },
        `${primary.charAt(0).toUpperCase() + primary.slice(1)} failed`,
      );

      const isRecoverable = errObj.status === 429 || errObj.status === 404;
      if (fallbackAvailable && isRecoverable) {
        logger.warn(
          { event: 'ai_provider_fallback_triggered', fromProvider: primary, toProvider: fallback, failureCategory, requestId: context?.requestId },
          `Falling back from ${primary.charAt(0).toUpperCase() + primary.slice(1)}`,
        );
        try {
          const result = await callProvider(fallback, prompt, options);
          const costEstimate = estimateAICost({
            workspaceId: context?.workspaceId ?? null,
            provider: result.provider,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            tokensUsed: result.tokensUsed,
          });
          logger.info(
            {
              event: 'ai_provider_fallback_success',
              provider: fallback,
              operation: context?.operation,
              requestId: context?.requestId,
              workspaceId: context?.workspaceId ?? null,
              model: result.model,
              tokensUsed: result.tokensUsed,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              estimatedCostUsd: costEstimate.estimatedCostUsd,
              costEvidence: costEstimate.evidence,
            },
            `${fallback} response received successfully`,
          );
          logger.info(
            {
              event: 'ai_response_cost_estimated',
              provider: result.provider,
              model: result.model,
              operation: context?.operation,
              requestId: context?.requestId,
              workspaceId: context?.workspaceId ?? null,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              tokensUsed: result.tokensUsed,
              estimatedCostUsd: costEstimate.estimatedCostUsd,
              costEvidence: costEstimate.evidence,
            },
            'AI response cost estimated',
          );
          const envelope = {
            ...result,
            workspaceId: context?.workspaceId ?? null,
            estimatedCostUsd: costEstimate.estimatedCostUsd,
            costEvidence: costEstimate.evidence,
          };
          return envelope;
        } catch (fallbackErr: unknown) {
          const fallbackErrObj = isAIProviderError(fallbackErr) ? fallbackErr : {};
          logger.error(
            { event: 'ai_provider_failure', provider: fallback, failureCategory: categorizeError(fallbackErr), requestId: context?.requestId, error: fallbackErrObj.message },
            `${fallback} fallback also failed`,
          );
          throw fallbackErr;
        }
      }
      throw err;
    }
  }

  // Primary not available, use fallback directly
  if (fallbackAvailable) {
    try {
      const result = await callProvider(fallback, prompt, options);
      const costEstimate = estimateAICost({
        workspaceId: context?.workspaceId ?? null,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        tokensUsed: result.tokensUsed,
      });
      logger.info(
        {
          event: 'ai_provider_success',
          provider: fallback,
          operation: context?.operation,
          requestId: context?.requestId,
          workspaceId: context?.workspaceId ?? null,
          model: result.model,
          tokensUsed: result.tokensUsed,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd: costEstimate.estimatedCostUsd,
          costEvidence: costEstimate.evidence,
        },
        `${fallback} response received successfully`,
      );
      logger.info(
        {
          event: 'ai_response_cost_estimated',
          provider: result.provider,
          model: result.model,
          operation: context?.operation,
          requestId: context?.requestId,
          workspaceId: context?.workspaceId ?? null,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          tokensUsed: result.tokensUsed,
          estimatedCostUsd: costEstimate.estimatedCostUsd,
          costEvidence: costEstimate.evidence,
        },
        'AI response cost estimated',
      );
      const envelope = {
        ...result,
        workspaceId: context?.workspaceId ?? null,
        estimatedCostUsd: costEstimate.estimatedCostUsd,
        costEvidence: costEstimate.evidence,
      };
      return envelope;
    } catch (err: unknown) {
      const failureCategory = categorizeError(err);
      const errObj = isAIProviderError(err) ? err : {};
      logger.error(
        { event: 'ai_provider_failure', provider: fallback, failureCategory, requestId: context?.requestId, error: errObj.message },
        `${fallback} primary request failed`,
      );
      throw err;
    }
  }

  throw new Error('Unreachable: No AI provider available');
}

export async function estimateTokens(text: string): Promise<number> {
  try {
    return await openai.estimateTokens(text);
  } catch (error) {
    logger.warn(
      {
        event: 'ai_token_estimate_fallback',
        error: error instanceof Error ? error.message : String(error),
      },
      'Falling back to heuristic token estimate',
    );
    // Rough estimate: ~4 chars per token for Portuguese
    return Math.ceil(text.length / 4);
  }
}

