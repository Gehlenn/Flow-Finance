import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  hasProcessedExternalEvent,
  markExternalEventProcessed,
  resetExternalIdempotencyStoreForTests,
} from '../../src/services/externalIdempotencyStore';

const stateFile = path.resolve(__dirname, '../../data/external-idempotency.json');

afterEach(() => {
  resetExternalIdempotencyStoreForTests();
  if (fs.existsSync(stateFile)) {
    fs.rmSync(stateFile, { force: true });
  }
});

describe('external idempotency store', () => {
  it('treats malformed persisted state as empty instead of throwing', () => {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, '{"processed":42}', 'utf8');

    expect(hasProcessedExternalEvent('workspace-1', 'evt-1')).toBe(false);
  });

  it('persists and detects processed events', () => {
    markExternalEventProcessed('workspace-1', 'evt-1');

    expect(hasProcessedExternalEvent('workspace-1', 'evt-1')).toBe(true);
  });
});
