/**
 * AI Memory Store
 * Manages persistence and retrieval of AI memories
 */

import {
  AIMemoryEntry,
  AIMemoryType,
  MemoryQueryFilter,
  MemoryStats,
  MemoryDecayConfig,
} from './memoryTypes';

const STORAGE_KEY = 'flow_ai_memory_v2';
const MAX_MEMORIES_PER_USER = 500;
const DEFAULT_DECAY_CONFIG: MemoryDecayConfig = {
  enabled: true,
  decayRate: 0.01, // 1% per day
  minConfidence: 0.2,
  timeWindow: 90, // 90 days
};

class AIMemoryStore {
  private memories: Map<string, AIMemoryEntry> = new Map();
  private initialized = false;
  private decayConfig: MemoryDecayConfig = DEFAULT_DECAY_CONFIG;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AIMemoryEntry[];
        this.memories = new Map(parsed.map((m) => [m.id, m]));
        this.applyDecay();
      }
      this.initialized = true;
    } catch (error) {
      console.error('[AI Memory Store] Failed to load:', error);
      this.memories = new Map();
      this.initialized = true;
    }
  }

  private saveToStorage(): void {
    try {
      const entries = Array.from(this.memories.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('[AI Memory Store] Failed to save:', error);
    }
  }

  private applyDecay(): void {
    if (!this.decayConfig.enabled) return;

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let decayed = 0;

    for (const [id, memory] of this.memories) {
      const daysSinceUpdate = (now - memory.updatedAt) / oneDayMs;
      
      if (daysSinceUpdate > this.decayConfig.timeWindow) {
        // Apply decay
        const decayAmount = daysSinceUpdate * this.decayConfig.decayRate;
        memory.confidence = Math.max(0, memory.confidence - decayAmount);
        memory.strength = Math.max(0, memory.strength - decayAmount * 100);

        if (memory.confidence < this.decayConfig.minConfidence) {
          this.memories.delete(id);
          decayed++;
        }
      }
    }

    if (decayed > 0) {
      console.log(`[AI Memory Store] Decayed ${decayed} old memories`);
      this.saveToStorage();
    }
  }

  saveMemory(memory: AIMemoryEntry): void {
    // Enforce per-user limits
    const userMemories = this.getMemoriesByUser(memory.userId);
    if (userMemories.length >= MAX_MEMORIES_PER_USER) {
      // Remove oldest low-confidence memory
      const sorted = userMemories.sort((a, b) => a.confidence - b.confidence || a.updatedAt - b.updatedAt);
      if (sorted.length > 0) {
        this.memories.delete(sorted[0].id);
      }
    }

    this.memories.set(memory.id, memory);
    this.saveToStorage();
  }

  getMemory(id: string): AIMemoryEntry | undefined {
    return this.memories.get(id);
  }

  getMemoriesByUser(userId: string): AIMemoryEntry[] {
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getMemoriesByType(userId: string, type: AIMemoryType): AIMemoryEntry[] {
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId && m.type === type)
      .sort((a, b) => b.strength - a.strength);
  }

  queryMemories(filter: MemoryQueryFilter): AIMemoryEntry[] {
    let results = Array.from(this.memories.values()).filter((m) => m.userId === filter.userId);

    if (filter.type) {
      results = results.filter((m) => m.type === filter.type);
    }

    if (filter.minConfidence !== undefined) {
      results = results.filter((m) => m.confidence >= filter.minConfidence!);
    }

    if (filter.minStrength !== undefined) {
      results = results.filter((m) => m.strength >= filter.minStrength!);
    }

    if (filter.startDate) {
      results = results.filter((m) => m.createdAt >= filter.startDate!);
    }

    if (filter.endDate) {
      results = results.filter((m) => m.createdAt <= filter.endDate!);
    }

    // Sort by strength (descending) then confidence (descending)
    results.sort((a, b) => b.strength - a.strength || b.confidence - a.confidence);

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  updateMemory(id: string, updates: Partial<AIMemoryEntry>): void {
    const memory = this.memories.get(id);
    if (memory) {
      Object.assign(memory, updates, { updatedAt: Date.now() });
      this.memories.set(id, memory);
      this.saveToStorage();
    }
  }

  deleteMemory(id: string): void {
    this.memories.delete(id);
    this.saveToStorage();
  }

  clearUserMemories(userId: string): void {
    for (const [id, memory] of this.memories) {
      if (memory.userId === userId) {
        this.memories.delete(id);
      }
    }
    this.saveToStorage();
  }

  getStats(userId: string): MemoryStats {
    const userMemories = this.getMemoriesByUser(userId);

    const byType: Record<AIMemoryType, number> = {} as any;
    for (const type of Object.values(AIMemoryType)) {
      byType[type] = 0;
    }

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

  setDecayConfig(config: Partial<MemoryDecayConfig>): void {
    this.decayConfig = { ...this.decayConfig, ...config };
  }

  getAllMemories(): AIMemoryEntry[] {
    return Array.from(this.memories.values());
  }

  clear(): void {
    this.memories.clear();
    this.saveToStorage();
  }
}

// Singleton instance
export const aiMemoryStore = new AIMemoryStore();
