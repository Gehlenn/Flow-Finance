import { beforeEach, describe, expect, it } from 'vitest';
import {
  claimExternalEventProcessed,
  hasProcessedExternalEvent,
  markExternalEventProcessed,
  resetExternalIdempotencyStoreForTests,
} from '../../backend/src/services/externalIdempotencyStore';

describe('externalIdempotencyStore', () => {
  beforeEach(() => {
    resetExternalIdempotencyStoreForTests();
  });

  it('marks and checks processed events', async () => {
    expect(await hasProcessedExternalEvent('ws_1', 'evt_1')).toBe(false);

    await markExternalEventProcessed('ws_1', 'evt_1');

    expect(await hasProcessedExternalEvent('ws_1', 'evt_1')).toBe(true);
  });

  it('claims duplicate events only once', async () => {
    await expect(claimExternalEventProcessed('ws_1', 'evt_claim')).resolves.toBe(true);
    await expect(claimExternalEventProcessed('ws_1', 'evt_claim')).resolves.toBe(false);
  });

  it('isolates by workspace id', async () => {
    await markExternalEventProcessed('ws_1', 'evt_1');

    expect(await hasProcessedExternalEvent('ws_2', 'evt_1')).toBe(false);
  });
});
