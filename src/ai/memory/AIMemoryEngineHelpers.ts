import { AIMemoryEntry, AIMemoryType } from './memoryTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getMemoryConfidenceBand(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

export function resolveMemoryExpiryWindowMs(type: AIMemoryType, key: string): number {
  if (type !== AIMemoryType.SPENDING_PATTERN) {
    return 45 * DAY_MS;
  }

  if (key === 'category_dominance' || key === 'money_map_distribution') {
    return 30 * DAY_MS;
  }

  return 21 * DAY_MS;
}

export function resolveMemoryContextDecayMultiplier(type: AIMemoryType, key: string): number {
  if (type !== AIMemoryType.SPENDING_PATTERN) {
    return 1;
  }

  if (key === 'category_dominance') {
    return 1.3;
  }

  if (key === 'money_map_distribution') {
    return 1.15;
  }

  return 1;
}

export function buildMemoryMetadata(
  type: AIMemoryType,
  key: string,
  confidence: number,
  now: number,
  current?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const shouldTrackDistributionSignal =
    type === AIMemoryType.SPENDING_PATTERN &&
    (key === 'category_dominance' || key === 'money_map_distribution');

  if (!shouldTrackDistributionSignal) {
    return current;
  }

  return {
    ...(current || {}),
    signalType: 'category_distribution',
    confidenceScore: Number(confidence.toFixed(3)),
    confidenceBand: getMemoryConfidenceBand(confidence),
    expiresAt: now + resolveMemoryExpiryWindowMs(type, key),
    contextDecayMultiplier: resolveMemoryContextDecayMultiplier(type, key),
  };
}

export function buildFeedbackMetadata(
  memory: AIMemoryEntry,
  feedback: 'positive' | 'negative',
  context?: string,
  now: number = Date.now(),
): Record<string, unknown> {
  return {
    ...(memory.metadata || {}),
    confidenceBand: getMemoryConfidenceBand(memory.confidence),
    feedbackCount: Number(memory.metadata?.feedbackCount ?? 0) + 1,
    lastFeedback: feedback,
    lastFeedbackContext: context || 'general',
    lastFeedbackAt: now,
  };
}

export function generateAIMemoryId(now: number = Date.now()): string {
  return `mem_${now}_${Math.random().toString(36).slice(2, 11)}`;
}

export function selectMemoryToEvict(memories: AIMemoryEntry[]): AIMemoryEntry | undefined {
  if (memories.length === 0) {
    return undefined;
  }

  return [...memories].sort((left, right) => {
    const confidenceDiff = left.confidence - right.confidence;
    if (confidenceDiff !== 0) return confidenceDiff;
    return left.updatedAt - right.updatedAt;
  })[0];
}

export function buildMemoryUpdateMetadata(
  type: AIMemoryType,
  key: string,
  confidence: number,
  now: number,
  current?: Record<string, unknown>,
): Record<string, unknown> {
  return (
    buildMemoryMetadata(type, key, confidence, now, current) ||
    {
      ...(current || {}),
    }
  );
}

export function persistAnalyzedMemorySet<TValue>(params: {
  userId: string;
  type: AIMemoryType;
  values: Map<string, TValue>;
  saveOrUpdate: (userId: string, type: AIMemoryType, key: string, value: TValue, confidence: number) => void;
  confidenceFor: (value: TValue, key: string) => number;
}): number {
  let updated = 0;

  for (const [key, value] of params.values) {
    params.saveOrUpdate(params.userId, params.type, key, value, params.confidenceFor(value, key));
    updated += 1;
  }

  return updated;
}

export type MemoryAnalysisStep<TValue> = {
  type: AIMemoryType;
  values: Map<string, TValue>;
  confidenceFor: (value: TValue, key: string) => number;
};

export function runMemoryAnalysisSteps(
  userId: string,
  steps: Array<MemoryAnalysisStep<unknown>>,
  saveOrUpdate: (userId: string, type: AIMemoryType, key: string, value: unknown, confidence: number) => void,
): number {
  let updated = 0;

  for (const step of steps) {
    updated += persistAnalyzedMemorySet({
      userId,
      type: step.type,
      values: step.values,
      saveOrUpdate,
      confidenceFor: step.confidenceFor,
    });
  }

  return updated;
}
