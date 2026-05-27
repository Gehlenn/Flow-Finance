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
