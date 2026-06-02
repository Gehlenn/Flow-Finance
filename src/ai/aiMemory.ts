import { makeId } from '../utils/helpers';
import { getActiveWorkspaceScopedStorageKey } from '../utils/workspaceStorage';
import { logWarn } from '../utils/logger';
import {
  buildUserMemoryProfile as buildUserMemoryProfileFromHelpers,
  inferMemorySource,
  parseMemoryDate,
  type MemorySource,
} from './aiMemoryHelpers';
import { Transaction, TransactionType } from '../../types';

const STORAGE_KEY = 'flow_ai_memory';

export interface AIMemory {
  id: string;
  user_id: string;
  key: string;
  value: string;
  confidence: number;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

function readAll(): AIMemory[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(getActiveWorkspaceScopedStorageKey(STORAGE_KEY)) || '[]');
    if (!Array.isArray(parsed)) {
      logWarn('[AIMemory] Memory storage has invalid shape; returning empty set', {
        storageKey: getActiveWorkspaceScopedStorageKey(STORAGE_KEY),
        fallback: 'ai-memory-invalid-shape',
      });
      return [];
    }
    return parsed;
  } catch (error) {
    logWarn('[AIMemory] Failed to parse memory storage; returning empty set', {
      storageKey: getActiveWorkspaceScopedStorageKey(STORAGE_KEY),
      error,
      fallback: 'ai-memory-parse-failed',
    });
    return [];
  }
}

function writeAll(entries: AIMemory[]): void {
  localStorage.setItem(getActiveWorkspaceScopedStorageKey(STORAGE_KEY), JSON.stringify(entries));
}

export function getAIMemorySnapshot(userId: string): AIMemory[] {
  return readAll().filter((memory) => memory.user_id === userId);
}

export async function getAIMemory(userId: string): Promise<AIMemory[]> {
  return getAIMemorySnapshot(userId);
}

export async function storeMemory(memory: AIMemory): Promise<void> {
  const all = readAll();
  all.push(memory);
  writeAll(all);
}

export async function updateMemory(memory: AIMemory): Promise<void> {
  const all = readAll().map((m) => (m.id === memory.id ? { ...memory, updated_at: new Date().toISOString() } : m));
  writeAll(all);
}

export async function deleteMemory(memoryId: string): Promise<void> {
  writeAll(readAll().filter((m) => m.id !== memoryId));
}

export async function learnMemory(
  userId: string,
  key: string,
  value: string,
  confidence: number,
  options?: {
    source?: MemorySource;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const all = readAll();
  const existing = all.find((m) => m.user_id === userId && m.key === key);
  const source = options?.source ?? existing?.metadata?.source ?? inferMemorySource(key);
  const metadata = {
    ...(existing?.metadata ?? {}),
    ...(options?.metadata ?? {}),
    source,
  };

  if (existing) {
    const updated: AIMemory = {
      ...existing,
      value,
      confidence,
      updated_at: new Date().toISOString(),
      metadata,
    };
    writeAll(all.map((m) => (m.id === existing.id ? updated : m)));
  } else {
    const newEntry: AIMemory = {
      id: makeId(),
      user_id: userId,
      key,
      value,
      confidence,
      updated_at: new Date().toISOString(),
      metadata,
    };
    all.push(newEntry);
    writeAll(all);
  }
}

export async function detectAndLearnPatterns(userId: string, transactions: Transaction[]): Promise<void> {
  if (transactions.length < 3) return;

  const weekendSpending = transactions.filter((t) => {
    const day = parseMemoryDate(t.date)?.getDay();
    return t.type === TransactionType.DESPESA && (day === 0 || day === 6);
  });
  const totalSpending = transactions.filter((t) => t.type === TransactionType.DESPESA);
  if (totalSpending.length > 0) {
    const weekendRatio = weekendSpending.length / totalSpending.length;
    if (weekendRatio > 0.3) {
      await learnMemory(userId, 'weekend_spending', 'high', Math.min(weekendRatio, 1));
    }
  }

  const merchantCount: Record<string, number> = {};
  for (const t of transactions) {
    const key = (t.merchant || t.description).toLowerCase().trim();
    merchantCount[key] = (merchantCount[key] || 0) + 1;
  }
  const topMerchant = Object.entries(merchantCount).sort((a, b) => b[1] - a[1])[0];
  if (topMerchant && topMerchant[1] >= 3) {
    await learnMemory(userId, 'frequent_merchant', topMerchant[0], Math.min(topMerchant[1] / 10, 1));
  }

  const recurringCount = transactions.filter((t) => t.recurring === true).length;
  if (recurringCount > 0) {
    await learnMemory(userId, 'recurring_expenses', String(recurringCount), Math.min(recurringCount / 5, 1));
  }
}

export async function getUserMemoryProfile(userId: string): Promise<{
  userId: string;
  patterns: AIMemory[];
  spending_profile: AIMemory[];
  merchant_categories: AIMemory[];
}> {
  const memories = await getAIMemory(userId);
  return buildUserMemoryProfileFromHelpers(memories, userId);
}
