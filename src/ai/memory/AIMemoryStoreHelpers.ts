import { AIMemoryEntry, AIMemoryType, MemoryDecayConfig, MemoryStats } from './memoryTypes';
import { logInfo } from '../../utils/logger';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function buildEmptyByType(): Record<AIMemoryType, number> {
  return Object.fromEntries(Object.values(AIMemoryType).map((type) => [type, 0])) as Record<AIMemoryType, number>;
}

export function buildMemoryStats(userMemories: AIMemoryEntry[]): MemoryStats {
  const byType = buildEmptyByType();

  let totalConfidence = 0;
  let totalStrength = 0;
  let oldest = Infinity;
  let newest = 0;

  for (const memory of userMemories) {
    byType[memory.type]++;
    totalConfidence += memory.confidence;
    totalStrength += memory.strength;
    oldest = Math.min(oldest, memory.createdAt);
    newest = Math.max(newest, memory.createdAt);
  }

  return {
    totalMemories: userMemories.length,
    byType,
    avgConfidence: userMemories.length > 0 ? totalConfidence / userMemories.length : 0,
    avgStrength: userMemories.length > 0 ? totalStrength / userMemories.length : 0,
    oldestMemory: oldest === Infinity ? undefined : oldest,
    newestMemory: newest === 0 ? undefined : newest,
    lastUpdated: Date.now(),
  };
}

export function buildUserMemoryProfile(userId: string, memories: AIMemoryEntry[]): {
  userId: string;
  patterns: AIMemoryEntry[];
  spending_profile: AIMemoryEntry[];
  merchant_categories: AIMemoryEntry[];
} {
  return {
    userId,
    patterns: memories.filter((m) => m.type === AIMemoryType.SPENDING_PATTERN || m.type === AIMemoryType.TIME_PATTERN),
    spending_profile: memories.filter((m) => m.type === AIMemoryType.FINANCIAL_PROFILE),
    merchant_categories: memories.filter((m) => m.type === AIMemoryType.MERCHANT_CATEGORY),
  };
}

export function isMemoryExpired(memory: AIMemoryEntry, now: number = Date.now()): boolean {
  const expiresAt = memory.metadata?.expiresAt;
  return typeof expiresAt === 'number' && expiresAt <= now;
}

export function pruneExpiredMemoryEntries(memories: Map<string, AIMemoryEntry>, now: number = Date.now()): number {
  let removed = 0;
  for (const [id, memory] of memories) {
    if (isMemoryExpired(memory, now)) {
      memories.delete(id);
      removed += 1;
    }
  }

  return removed;
}

export function applyMemoryDecay(
  memories: Map<string, AIMemoryEntry>,
  decayConfig: MemoryDecayConfig,
  now: number = Date.now(),
): number {
  if (!decayConfig.enabled) return 0;

  let decayed = 0;

  for (const [id, memory] of memories) {
    const daysSinceUpdate = (now - memory.updatedAt) / ONE_DAY_MS;

    if (daysSinceUpdate > decayConfig.timeWindow) {
      const contextMultiplier =
        typeof memory.metadata?.contextDecayMultiplier === 'number'
          ? Math.max(0.1, memory.metadata.contextDecayMultiplier)
          : 1;
      const decayAmount = daysSinceUpdate * decayConfig.decayRate * contextMultiplier;
      memory.confidence = Math.max(0, memory.confidence - decayAmount);
      memory.strength = Math.max(0, memory.strength - decayAmount * 100);

      if (memory.confidence < decayConfig.minConfidence) {
        memories.delete(id);
        decayed++;
      }
    }
  }

  return decayed;
}

export function logDecayIfNeeded(decayed: number, storageKey: string): void {
  if (decayed > 0) {
    logInfo('[AI Memory Store] Decayed old memories', {
      decayed,
      storageKey,
      fallback: 'ai-memory-store-decayed-old-memories',
    });
  }
}
