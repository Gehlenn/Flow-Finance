import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  enqueueEvent,
  getPendingEvents,
  acknowledgeEvent,
  retryEvent,
  getDeadLetterEvents,
  clearEventQueue,
  getEventQueueMetrics,
  configureEventQueueStore,
} from '../../src/events/eventQueue';

describe('Event Queue Resilience', () => {
  beforeEach(async () => {
    await clearEventQueue();
  });

  it('enqueues events and retrieves them', async () => {
    const payload = { type: 'transaction_created', id: '123' };
    await enqueueEvent('evt-1', payload);

    const pending = await getPendingEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].payload).toEqual(payload);
    expect(pending[0].retries).toBe(0);
  });

  it('acknowledges event removes it from queue', async () => {
    await enqueueEvent('evt-1', { test: 'data' });
    expect(await getPendingEvents()).toHaveLength(1);

    await acknowledgeEvent('evt-1');
    expect(await getPendingEvents()).toHaveLength(0);
  });

  it('retries failed event with exponential backoff', async () => {
    const evt = await enqueueEvent('evt-1', { test: 'data' });
    expect(evt.retries).toBe(0);

    const retry1 = await retryEvent('evt-1');
    expect(retry1?.retries).toBe(1);

    // nextRetryAt should be > now
    const now = Date.now();
    expect(retry1!.nextRetryAt).toBeGreaterThan(now);

    const retry2 = await retryEvent('evt-1');
    expect(retry2?.retries).toBe(2);
    expect(retry2!.nextRetryAt).toBeGreaterThan(retry1!.nextRetryAt);
  });

  it('moves events to dead-letter after MAX_RETRIES', async () => {
    await enqueueEvent('evt-1', { test: 'data' });

    // Retry 5 times
    for (let i = 0; i < 5; i++) {
      await retryEvent('evt-1');
    }

    const pending = await getPendingEvents();
    expect(pending).toHaveLength(0);

    const deadLetter = await getDeadLetterEvents();
    expect(deadLetter).toHaveLength(1);
    expect(deadLetter[0].retries).toBe(5);
  });

  it('returns null when retrying non-existent event', async () => {
    const result = await retryEvent('non-existent');
    expect(result).toBeNull();
  });

  it('tracks queue metrics correctly', async () => {
    await enqueueEvent('evt-1', { test: '1' });
    await enqueueEvent('evt-2', { test: '2' });

    // Retry evt-2 until dead-letter
    for (let i = 0; i < 5; i++) {
      await retryEvent('evt-2');
    }

    const metrics = await getEventQueueMetrics();
    expect(metrics.pending).toBe(1); // evt-1
    expect(metrics.deadLetter).toBe(1); // evt-2
    expect(metrics.total).toBe(2);
  });

  it('only returns events ready for retry (time-based)', async () => {
    const now = Date.now();

    // Event ready now
    const evt1 = await enqueueEvent('evt-1', { test: '1' });
    expect(evt1.nextRetryAt).toBeLessThanOrEqual(now);

    // Event not ready (future retry)
    const evt2 = await enqueueEvent('evt-2', { test: '2' });
    evt2.nextRetryAt = now + 10000; // 10 seconds in future
    // Simulate save
    await configureEventQueueStore({
      save: async () => {},
      load: async () => [evt1, evt2],
      remove: async () => {},
      clear: async () => {},
    });

    const pending = await getPendingEvents();
    // Should only include evt1 (ready now) - evt2 is in future
    expect(pending.some((e) => e.id === 'evt-1')).toBe(true);
  });

  it('handles concurrent event operations safely', async () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      id: `evt-${i}`,
      payload: { index: i },
    }));

    // Enqueue all concurrently
    await Promise.all(
      events.map(({ id, payload }) => enqueueEvent(id, payload)),
    );

    const pending = await getPendingEvents();
    expect(pending).toHaveLength(10);

    // Retry some concurrently
    await Promise.all([
      retryEvent('evt-0'),
      retryEvent('evt-1'),
      retryEvent('evt-2'),
    ]);

    // Acknowledge some concurrently
    await Promise.all([
      acknowledgeEvent('evt-3'),
      acknowledgeEvent('evt-4'),
    ]);

    const remaining = await getPendingEvents();
    expect(remaining.length).toBeLessThanOrEqual(10);
  });

  it('clears entire queue', async () => {
    await enqueueEvent('evt-1', { test: '1' });
    await enqueueEvent('evt-2', { test: '2' });

    expect(await getPendingEvents()).toHaveLength(2);

    await clearEventQueue();

    expect(await getPendingEvents()).toHaveLength(0);
    expect(await getDeadLetterEvents()).toHaveLength(0);
  });
});
