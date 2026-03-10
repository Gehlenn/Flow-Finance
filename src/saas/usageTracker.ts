import { ResourceKind } from './types';

interface UsageSnapshot {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
}

const usageStore = new Map<string, UsageSnapshot>();

function getMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildKey(userId: string, monthKey: string): string {
  return `${userId}:${monthKey}`;
}

function getOrCreateUsage(userId: string, monthKey: string): UsageSnapshot {
  const key = buildKey(userId, monthKey);

  if (!usageStore.has(key)) {
    usageStore.set(key, {
      transactions: 0,
      aiQueries: 0,
      bankConnections: 0,
    });
  }

  return usageStore.get(key)!;
}

export function getCurrentUsage(userId: string, resource: ResourceKind, at = new Date()): number {
  const usage = getOrCreateUsage(userId, getMonthKey(at));
  return usage[resource];
}

export function trackUsage(userId: string, resource: ResourceKind, amount = 1, at = new Date()): number {
  const usage = getOrCreateUsage(userId, getMonthKey(at));
  usage[resource] += amount;
  return usage[resource];
}

export function resetUsageForUser(userId: string, at = new Date()): void {
  usageStore.delete(buildKey(userId, getMonthKey(at)));
}
