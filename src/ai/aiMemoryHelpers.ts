import type { AIMemory } from './aiMemory';

export type MemorySource = 'conversa' | 'transação' | 'inferência recorrente' | 'categorização' | 'manual';

export function parseMemoryDate(value: string): Date | null {
  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const parsed = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function inferMemorySource(key: string): MemorySource {
  if (key.includes('merchant') || key.includes('category')) {
    return 'categorização';
  }

  if (
    key.includes('weekend') ||
    key.includes('recurring') ||
    key.includes('salary') ||
    key.includes('balance') ||
    key.includes('pattern') ||
    key.includes('profile')
  ) {
    return 'inferência recorrente';
  }

  if (
    key.includes('budget') ||
    key.includes('asks_') ||
    key.includes('conversa') ||
    key.includes('user_')
  ) {
    return 'conversa';
  }

  return 'transação';
}

export function buildUserMemoryProfile(memories: AIMemory[], userId: string): {
  userId: string;
  patterns: AIMemory[];
  spending_profile: AIMemory[];
  merchant_categories: AIMemory[];
} {
  return {
    userId,
    patterns: memories.filter((m) => m.key.includes('pattern') || m.key.includes('weekend')),
    spending_profile: memories.filter((m) => m.key.includes('profile') || m.key.includes('recurring')),
    merchant_categories: memories.filter((m) => m.key.includes('merchant')),
  };
}
