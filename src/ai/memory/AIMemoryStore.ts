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
import { logWarn } from '../../utils/logger';
import { getActiveWorkspaceScopedStorageKey } from '../../utils/workspaceStorage';
import {
  applyMemoryDecay,
  buildDefaultMemoryEntry,
  buildMemoryStats,
  buildUserMemoryProfile,
  logDecayIfNeeded,
  pruneExpiredMemoryEntries,
  pickMemoryToEvict,
} from './AIMemoryStoreHelpers';

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
  private activeStorageKey = '';

  constructor() {
    this.loadFromStorage();
  }

  private getStorageKey(): string {
    return getActiveWorkspaceScopedStorageKey(STORAGE_KEY);
  }

  private ensureWorkspaceScope(): void {
    const nextStorageKey = this.getStorageKey();
    if (!this.initialized || this.activeStorageKey !== nextStorageKey) {
      this.loadFromStorage();
    }
  }

  private loadFromStorage(): void {
    this.activeStorageKey = this.getStorageKey();
    try {
      const stored = localStorage.getItem(this.activeStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as AIMemoryEntry[];
        this.memories = new Map(parsed.map((m) => [m.id, m]));
        this.applyDecay();
      } else {
        this.memories = new Map();
      }
      this.initialized = true;
    } catch (error) {
      logWarn('[AI Memory Store] Failed to load; returning empty memory set', {
        storageKey: this.activeStorageKey,
        error,
      });
      this.memories = new Map();
      this.initialized = true;
    }
  }

  private saveToStorage(): void {
    this.ensureWorkspaceScope();
    try {
      const entries = Array.from(this.memories.values());
      localStorage.setItem(this.activeStorageKey, JSON.stringify(entries));
    } catch (error) {
      logWarn('[AI Memory Store] Failed to save; keeping in-memory state', {
        storageKey: this.activeStorageKey,
        error,
      });
    }
  }

  private applyDecay(): void {
    const decayed = applyMemoryDecay(this.memories, this.decayConfig);
    logDecayIfNeeded(decayed, this.activeStorageKey);

    if (decayed > 0) {
      this.saveToStorage();
    }
  }

  private pruneExpiredMemories(): void {
    const removed = pruneExpiredMemoryEntries(this.memories);
    if (removed > 0) {
      this.saveToStorage();
    }
  }

  private getActiveMemoryValues(): AIMemoryEntry[] {
    this.ensureWorkspaceScope();
    this.pruneExpiredMemories();
    return Array.from(this.memories.values());
  }

  private withScopedMutation(mutator: () => boolean): void {
    this.ensureWorkspaceScope();
    if (mutator()) {
      this.saveToStorage();
    }
  }

  private withWorkspaceScope<T>(reader: () => T): T {
    this.ensureWorkspaceScope();
    return reader();
  }

  saveMemory(memory: AIMemoryEntry): void {
    this.withScopedMutation(() => {
      const userMemories = this.getMemoriesByUser(memory.userId);
      if (userMemories.length >= MAX_MEMORIES_PER_USER) {
        const memoryToEvict = pickMemoryToEvict(userMemories);
        if (memoryToEvict) {
          this.memories.delete(memoryToEvict.id);
        }
      }

      this.memories.set(memory.id, memory);
      return true;
    });
  }

  save(memory: Partial<AIMemoryEntry> & { type: AIMemoryType; value: unknown; key?: string; userId?: string }): void {
    this.saveMemory(buildDefaultMemoryEntry(memory));
  }

  getMemory(id: string): AIMemoryEntry | undefined {
    return this.withWorkspaceScope(() => this.memories.get(id));
  }

  getMemoriesByUser(userId: string): AIMemoryEntry[] {
    return this.getActiveMemoryValues()
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getMemoriesByType(userId: string, type: AIMemoryType): AIMemoryEntry[] {
    return this.getActiveMemoryValues()
      .filter((m) => m.userId === userId && m.type === type)
      .sort((a, b) => b.strength - a.strength);
  }

  getByType(type: AIMemoryType, userId: string = 'local'): AIMemoryEntry[] {
    return this.getMemoriesByType(userId, type);
  }

  queryMemories(filter: MemoryQueryFilter): AIMemoryEntry[] {
    let results = this.getActiveMemoryValues().filter((m) => m.userId === filter.userId);

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
    this.withScopedMutation(() => {
      const memory = this.memories.get(id);
      if (!memory) {
        return false;
      }

      Object.assign(memory, updates, { updatedAt: Date.now() });
      this.memories.set(id, memory);
      return true;
    });
  }

  deleteMemory(id: string): void {
    this.withScopedMutation(() => this.memories.delete(id));
  }

  clearUserMemories(userId: string): void {
    this.withScopedMutation(() => {
      let removed = false;
      for (const [id, memory] of this.memories) {
        if (memory.userId === userId) {
          this.memories.delete(id);
          removed = true;
        }
      }
      return removed;
    });
  }

  getStats(userId: string): MemoryStats {
    return this.withWorkspaceScope(() => buildMemoryStats(this.getMemoriesByUser(userId)));
  }

  getUserMemoryProfile(userId: string): {
    userId: string;
    patterns: AIMemoryEntry[];
    spending_profile: AIMemoryEntry[];
    merchant_categories: AIMemoryEntry[];
  } {
    return this.withWorkspaceScope(() => buildUserMemoryProfile(userId, this.getMemoriesByUser(userId)));
  }

  setDecayConfig(config: Partial<MemoryDecayConfig>): void {
    this.decayConfig = { ...this.decayConfig, ...config };
  }

  runDecayCycle(): void {
    this.withWorkspaceScope(() => {
      this.applyDecay();
      this.saveToStorage();
    });
  }

  getAllMemories(): AIMemoryEntry[] {
    return this.withWorkspaceScope(() => this.getActiveMemoryValues());
  }

  getAll(): AIMemoryEntry[] {
    return this.getAllMemories();
  }

  clear(): void {
    this.withScopedMutation(() => {
      if (this.memories.size === 0) {
        return false;
      }

      this.memories.clear();
      return true;
    });
  }
}

// Singleton instance
export const aiMemoryStore = new AIMemoryStore();
