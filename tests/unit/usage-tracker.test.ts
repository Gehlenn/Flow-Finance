import { beforeEach, describe, expect, it } from 'vitest';
import { configureUsageStoreAdapter, getCurrentUsage, resetUsageForUser, trackUsage } from '../../src/saas/usageTracker';

describe('usageTracker', () => {
  beforeEach(async () => {
    await configureUsageStoreAdapter({
      async read() {
        return {};
      },
      async write() {
        return;
      },
    });
  });

  it('tracks usage with an in-memory adapter by default', async () => {
    expect(await getCurrentUsage('user_1', 'transactions', new Date('2026-04-10T00:00:00.000Z'))).toBe(0);
    expect(await trackUsage('user_1', 'transactions', 2, new Date('2026-04-10T00:00:00.000Z'))).toBe(2);
    expect(await getCurrentUsage('user_1', 'transactions', new Date('2026-04-10T00:00:00.000Z'))).toBe(2);
  });

  it('delegates increment and reset when the configured adapter supports them', async () => {
    let resetMonthKey: string | undefined;
    let readCalls = 0;

    await configureUsageStoreAdapter({
      async read() {
        readCalls += 1;
        return {};
      },
      async write() {
        return;
      },
      async increment() {
        return 3;
      },
      async reset(monthKey) {
        resetMonthKey = monthKey;
      },
    });

    expect(readCalls).toBe(1);
    expect(await getCurrentUsage('user_1', 'transactions', new Date('2026-04-10T00:00:00.000Z'))).toBe(0);
    expect(await trackUsage('user_1', 'transactions', 1, new Date('2026-04-10T00:00:00.000Z'))).toBe(3);
    expect(await getCurrentUsage('user_1', 'transactions', new Date('2026-04-10T00:00:00.000Z'))).toBe(3);

    await resetUsageForUser('user_1', new Date('2026-04-10T00:00:00.000Z'));
    expect(resetMonthKey).toBe('2026-04');
  });
});
