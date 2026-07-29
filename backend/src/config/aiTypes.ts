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
