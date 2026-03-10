import { ResourceKind } from './types';

interface UsageSnapshot {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
}

const usageStore = new Map<string, UsageSnapshot>();
const STORAGE_KEY = 'flow_saas_usage';

export interface UsageStoreAdapter {
  read(): Promise<Record<string, UsageSnapshot>>;
  write(data: Record<string, UsageSnapshot>): Promise<void>;
}

class LocalStorageUsageAdapter implements UsageStoreAdapter {
  async read(): Promise<Record<string, UsageSnapshot>> {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, UsageSnapshot>;
    } catch {
      return {};
    }
  }

  async write(data: Record<string, UsageSnapshot>): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

let usageAdapter: UsageStoreAdapter = new LocalStorageUsageAdapter();
let usageLoaded = false;

function toRecord(): Record<string, UsageSnapshot> {
  const out: Record<string, UsageSnapshot> = {};
  usageStore.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function fromRecord(record: Record<string, UsageSnapshot>): void {
  usageStore.clear();
  Object.entries(record).forEach(([key, value]) => usageStore.set(key, value));
}

async function ensureLoaded(): Promise<void> {
  if (usageLoaded) {
    return;
  }

  fromRecord(await usageAdapter.read());
  usageLoaded = true;
}

async function flush(): Promise<void> {
  await usageAdapter.write(toRecord());
}

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

export async function configureUsageStoreAdapter(adapter: UsageStoreAdapter): Promise<void> {
  usageAdapter = adapter;
  usageLoaded = false;
  await ensureLoaded();
}

export function getCurrentUsage(userId: string, resource: ResourceKind, at = new Date()): number {
  void ensureLoaded();
  const usage = getOrCreateUsage(userId, getMonthKey(at));
  return usage[resource];
}

export function trackUsage(userId: string, resource: ResourceKind, amount = 1, at = new Date()): number {
  void ensureLoaded();
  const usage = getOrCreateUsage(userId, getMonthKey(at));
  usage[resource] += amount;
  void flush();
  return usage[resource];
}

export function resetUsageForUser(userId: string, at = new Date()): void {
  void ensureLoaded();
  usageStore.delete(buildKey(userId, getMonthKey(at)));
  void flush();
}
