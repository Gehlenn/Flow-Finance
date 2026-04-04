import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasProcessedExternalEvent,
  markExternalEventProcessed,
  resetExternalIdempotencyStoreForTests,
} from '../../backend/src/services/externalIdempotencyStore';

describe('externalIdempotencyStore', () => {
  beforeEach(() => {
    resetExternalIdempotencyStoreForTests();
  });

  it('marks and checks processed events', () => {
    expect(hasProcessedExternalEvent('ws_1', 'evt_1')).toBe(false);

    markExternalEventProcessed('ws_1', 'evt_1');

    expect(hasProcessedExternalEvent('ws_1', 'evt_1')).toBe(true);
  });

  it('isolates by workspace id', () => {
    markExternalEventProcessed('ws_1', 'evt_1');

    expect(hasProcessedExternalEvent('ws_2', 'evt_1')).toBe(false);
  });
});
