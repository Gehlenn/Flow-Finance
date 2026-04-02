import { ResourceKind } from './types';

export interface UsageSnapshot {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
}

const usageStore = new Map<string, UsageSnapshot>();

export interface UsageStoreAdapter {
  read(): Promise<Record<string, UsageSnapshot>>;
  write(data: Record<string, UsageSnapshot>): Promise<void>;
  increment?(params: {
    resource: ResourceKind;
    amount: number;
    at: string;
    metadata?: Record<string, unknown>;
  }): Promise<number>;
  reset?(monthKey?: string): Promise<void>;
}

class MemoryUsageAdapter implements UsageStoreAdapter {
  private state: Record<string, UsageSnapshot> = {};

  async read(): Promise<Record<string, UsageSnapshot>> {
    return { ...this.state };
  }

  async write(data: Record<string, UsageSnapshot>): Promise<void> {
    this.state = { ...data };
  }
}

let usageAdapter: UsageStoreAdapter = new MemoryUsageAdapter();
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

export async function getCurrentUsage(userId: string, resource: ResourceKind, at = new Date()): Promise<number> {
  await ensureLoaded();
  const usage = getOrCreateUsage(userId, getMonthKey(at));
  return usage[resource];
}

export async function trackUsage(
  userId: string,
  resource: ResourceKind,
  amount = 1,
  at = new Date(),
  metadata?: Record<string, unknown>,
): Promise<number> {
  await ensureLoaded();

  if (usageAdapter.increment) {
    const total = await usageAdapter.increment({
      resource,
      amount,
      at: at.toISOString(),
      metadata,
    });
    const usage = getOrCreateUsage(userId, getMonthKey(at));
    usage[resource] = total;
    return total;
  }

  const usage = getOrCreateUsage(userId, getMonthKey(at));
  usage[resource] += amount;
  await flush();
  return usage[resource];
}

export async function resetUsageForUser(userId: string, at = new Date()): Promise<void> {
  await ensureLoaded();
  usageStore.delete(buildKey(userId, getMonthKey(at)));

  if (usageAdapter.reset) {
    await usageAdapter.reset(getMonthKey(at));
    return;
  }

  await flush();
}
