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

  saveMemory(memory: AIMemoryEntry): void {
    this.ensureWorkspaceScope();
    const userMemories = this.getMemoriesByUser(memory.userId);
    if (userMemories.length >= MAX_MEMORIES_PER_USER) {
      const memoryToEvict = pickMemoryToEvict(userMemories);
      if (memoryToEvict) {
        this.memories.delete(memoryToEvict.id);
      }
    }

    this.memories.set(memory.id, memory);
    this.saveToStorage();
  }

  save(memory: Partial<AIMemoryEntry> & { type: AIMemoryType; value: unknown; key?: string; userId?: string }): void {
    this.saveMemory(buildDefaultMemoryEntry(memory));
  }

  getMemory(id: string): AIMemoryEntry | undefined {
    this.ensureWorkspaceScope();
    return this.memories.get(id);
  }

  getMemoriesByUser(userId: string): AIMemoryEntry[] {
    this.ensureWorkspaceScope();
    this.pruneExpiredMemories();
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getMemoriesByType(userId: string, type: AIMemoryType): AIMemoryEntry[] {
    this.ensureWorkspaceScope();
    this.pruneExpiredMemories();
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId && m.type === type)
      .sort((a, b) => b.strength - a.strength);
  }

  getByType(type: AIMemoryType, userId: string = 'local'): AIMemoryEntry[] {
    return this.getMemoriesByType(userId, type);
  }

  queryMemories(filter: MemoryQueryFilter): AIMemoryEntry[] {
    this.ensureWorkspaceScope();
    this.pruneExpiredMemories();
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
    this.ensureWorkspaceScope();
    const memory = this.memories.get(id);
    if (memory) {
      Object.assign(memory, updates, { updatedAt: Date.now() });
      this.memories.set(id, memory);
      this.saveToStorage();
    }
  }

  deleteMemory(id: string): void {
    this.ensureWorkspaceScope();
    this.memories.delete(id);
    this.saveToStorage();
  }

  clearUserMemories(userId: string): void {
    this.ensureWorkspaceScope();
    for (const [id, memory] of this.memories) {
      if (memory.userId === userId) {
        this.memories.delete(id);
      }
    }
    this.saveToStorage();
  }

  getStats(userId: string): MemoryStats {
    this.ensureWorkspaceScope();
    const userMemories = this.getMemoriesByUser(userId);
    return buildMemoryStats(userMemories);
  }

  getUserMemoryProfile(userId: string): {
    userId: string;
    patterns: AIMemoryEntry[];
    spending_profile: AIMemoryEntry[];
    merchant_categories: AIMemoryEntry[];
  } {
    this.ensureWorkspaceScope();
    const memories = this.getMemoriesByUser(userId);
    return buildUserMemoryProfile(userId, memories);
  }

  setDecayConfig(config: Partial<MemoryDecayConfig>): void {
    this.decayConfig = { ...this.decayConfig, ...config };
  }

  runDecayCycle(): void {
    this.ensureWorkspaceScope();
    this.applyDecay();
    this.saveToStorage();
  }

  getAllMemories(): AIMemoryEntry[] {
    this.ensureWorkspaceScope();
    return Array.from(this.memories.values());
  }

  getAll(): AIMemoryEntry[] {
    return this.getAllMemories();
  }

  clear(): void {
    this.ensureWorkspaceScope();
    this.memories.clear();
    this.saveToStorage();
  }
}

// Singleton instance
export const aiMemoryStore = new AIMemoryStore();
