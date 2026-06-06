import type { AIProvider } from './types';

export type AICostEvidence =
  | 'provider_usage_tokens'
  | 'total_tokens_conservative_output_rate'
  | 'pricing_unknown';

export interface AICostSample {
  workspaceId?: string | null;
  provider: AIProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  tokensUsed?: number;
  status?: 'success' | 'fallback' | 'error';
}

export interface AICostEstimate {
  workspaceId: string | null;
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  evidence: AICostEvidence;
}

export interface WorkspaceAICostSummary {
  workspaceId: string;
  requestCount: number;
  totalTokens: number;
  estimatedCostUsd: number;
  byProvider: Record<string, { requestCount: number; estimatedCostUsd: number; totalTokens: number }>;
  generatedAt: string;
  evidence: 'estimated_from_tokens';
}

const DEFAULT_PRICING_PER_MILLION: Partial<Record<AIProvider, { input: number; output: number }>> = {
  openai: { input: 0.00015, output: 0.0006 },
  gemini: { input: 0.00075, output: 0.003 },
};

function positiveInteger(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN) || (value ?? 0) <= 0) return 0;
  return Math.floor(value as number);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

export function estimateAICost(sample: AICostSample): AICostEstimate {
  const pricing = DEFAULT_PRICING_PER_MILLION[sample.provider];
  const providedInputTokens = positiveInteger(sample.inputTokens);
  const providedOutputTokens = positiveInteger(sample.outputTokens);
  const providedTotalTokens = positiveInteger(sample.tokensUsed);

  if (!pricing) {
    return {
      workspaceId: sample.workspaceId ?? null,
      provider: sample.provider,
      model: sample.model,
      inputTokens: providedInputTokens,
      outputTokens: providedOutputTokens,
      totalTokens: providedTotalTokens || providedInputTokens + providedOutputTokens,
      estimatedCostUsd: 0,
      evidence: 'pricing_unknown',
    };
  }

  const hasProviderSplit = providedInputTokens > 0 || providedOutputTokens > 0;
  const inputTokens = hasProviderSplit ? providedInputTokens : 0;
  const outputTokens = hasProviderSplit ? providedOutputTokens : providedTotalTokens;
  const totalTokens = providedTotalTokens || inputTokens + outputTokens;
  const estimatedCostUsd = roundUsd(
    (inputTokens / 1_000_000) * pricing.input
    + (outputTokens / 1_000_000) * pricing.output,
  );

  return {
    workspaceId: sample.workspaceId ?? null,
    provider: sample.provider,
    model: sample.model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    evidence: hasProviderSplit ? 'provider_usage_tokens' : 'total_tokens_conservative_output_rate',
  };
}

export function summarizeWorkspaceAICost(
  samples: AICostSample[],
  workspaceId: string,
): WorkspaceAICostSummary {
  const matchingSamples = samples.filter((sample) => sample.workspaceId === workspaceId);
  const estimates = matchingSamples.map(estimateAICost);
  const byProvider: WorkspaceAICostSummary['byProvider'] = {};

  for (const estimate of estimates) {
    const current = byProvider[estimate.provider] ?? {
      requestCount: 0,
      estimatedCostUsd: 0,
      totalTokens: 0,
    };

    byProvider[estimate.provider] = {
      requestCount: current.requestCount + 1,
      estimatedCostUsd: roundUsd(current.estimatedCostUsd + estimate.estimatedCostUsd),
      totalTokens: current.totalTokens + estimate.totalTokens,
    };
  }

  return {
    workspaceId,
    requestCount: estimates.length,
    totalTokens: estimates.reduce((sum, estimate) => sum + estimate.totalTokens, 0),
    estimatedCostUsd: roundUsd(estimates.reduce((sum, estimate) => sum + estimate.estimatedCostUsd, 0)),
    byProvider,
    generatedAt: new Date().toISOString(),
    evidence: 'estimated_from_tokens',
  };
}
