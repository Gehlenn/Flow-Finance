/**
 * RESILIENT EVENT QUEUE
 * Durable local queue for unreliable network conditions.
 * Persists events to localStorage (client) or in-memory (server).
 * Supports retry with exponential backoff.
 */

import logger from '../config/logger';

export interface EventQueueItem {
  id: string;
  payload: unknown;
  timestamp: number;
  retries: number;
  nextRetryAt: number;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;

function calculateBackoffMs(retryCount: number): number {
  const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

export interface EventQueueStore {
  save(item: EventQueueItem): Promise<void>;
  load(): Promise<EventQueueItem[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

class InMemoryEventQueueStore implements EventQueueStore {
  private items: Map<string, EventQueueItem> = new Map();

  async save(item: EventQueueItem): Promise<void> {
    this.items.set(item.id, item);
  }

  async load(): Promise<EventQueueItem[]> {
    return Array.from(this.items.values());
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }

  async clear(): Promise<void> {
    this.items.clear();
  }
}

let eventQueueStore: EventQueueStore = new InMemoryEventQueueStore();

export async function configureEventQueueStore(store: EventQueueStore): Promise<void> {
  eventQueueStore = store;
}

export async function resetEventQueueStore(): Promise<void> {
  eventQueueStore = new InMemoryEventQueueStore();
}

/**
 * Add event to durable queue with retry logic.
 */
export async function enqueueEvent(id: string, payload: unknown): Promise<EventQueueItem> {
  const item: EventQueueItem = {
    id,
    payload,
    timestamp: Date.now(),
    retries: 0,
    nextRetryAt: Date.now(),
  };

  await eventQueueStore.save(item);
  return item;
}

/**
 * Get all events ready for retry.
 */
export async function getPendingEvents(): Promise<EventQueueItem[]> {
  const all = await eventQueueStore.load();
  const now = Date.now();
  return all.filter((item) => item.nextRetryAt <= now && item.retries < MAX_RETRIES);
}

/**
 * Mark event as successfully delivered.
 */
export async function acknowledgeEvent(id: string): Promise<void> {
  await eventQueueStore.remove(id);
}

/**
 * Mark event as failed and schedule next retry.
 */
export async function retryEvent(id: string): Promise<EventQueueItem | null> {
  const all = await eventQueueStore.load();
  const item = all.find((i) => i.id === id);

  if (!item) {
    return null;
  }

  if (item.retries >= MAX_RETRIES) {
    logger.warn({ id, retries: item.retries }, 'Event exceeded max retries, moving to dead-letter');
    await eventQueueStore.remove(id);
    return { ...item }; // Return snapshot for dead-letter handling
  }

  const nextRetries = item.retries + 1;
  const candidateNextRetryAt = Date.now() + calculateBackoffMs(nextRetries);
  // Keep retry timestamp monotonic even when retries happen within the same millisecond.
  const nextRetryAt = Math.max(candidateNextRetryAt, item.nextRetryAt + 1);

  const updatedItem: EventQueueItem = {
    ...item,
    retries: nextRetries,
    nextRetryAt,
  };

  await eventQueueStore.save(updatedItem);
  return updatedItem;
}

/**
 * Get all dead-letter events (exceeded retries).
 */
export async function getDeadLetterEvents(): Promise<EventQueueItem[]> {
  const all = await eventQueueStore.load();
  return all.filter((item) => item.retries >= MAX_RETRIES);
}

/**
 * Clear entire queue (testing only).
 */
export async function clearEventQueue(): Promise<void> {
  await eventQueueStore.clear();
}

/**
 * Get queue metrics.
 */
export async function getEventQueueMetrics(): Promise<{
  pending: number;
  deadLetter: number;
  total: number;
}> {
  const all = await eventQueueStore.load();
  const pending = all.filter((i) => i.retries < MAX_RETRIES).length;
  const deadLetter = all.filter((i) => i.retries >= MAX_RETRIES).length;

  return { pending, deadLetter, total: all.length };
}
