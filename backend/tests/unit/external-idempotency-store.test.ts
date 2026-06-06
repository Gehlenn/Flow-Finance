import { afterEach, describe, expect, it } from 'vitest';

import {
  claimExternalEventProcessed,
  hasProcessedExternalEvent,
  markExternalEventProcessed,
  resetExternalIdempotencyStoreForTests,
} from '../../src/services/externalIdempotencyStore';

afterEach(() => {
  resetExternalIdempotencyStoreForTests();
});

describe('external idempotency store', () => {
  it('returns false for an event that has not been processed', async () => {
    expect(await hasProcessedExternalEvent('workspace-1', 'evt-unknown')).toBe(false);
  });

  it('detects an event after it is marked processed', async () => {
    await markExternalEventProcessed('workspace-1', 'evt-1');
    expect(await hasProcessedExternalEvent('workspace-1', 'evt-1')).toBe(true);
  });

  it('claims an event only once', async () => {
    expect(await claimExternalEventProcessed('workspace-1', 'evt-claim')).toBe(true);
    expect(await claimExternalEventProcessed('workspace-1', 'evt-claim')).toBe(false);
  });

  it('does not leak processed events across workspaces', async () => {
    await markExternalEventProcessed('workspace-A', 'evt-1');
    expect(await hasProcessedExternalEvent('workspace-B', 'evt-1')).toBe(false);
  });

  it('does not leak processed events after reset', async () => {
    await markExternalEventProcessed('workspace-1', 'evt-2');
    resetExternalIdempotencyStoreForTests();
    expect(await hasProcessedExternalEvent('workspace-1', 'evt-2')).toBe(false);
  });
});
