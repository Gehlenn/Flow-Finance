import fs from 'fs';
import path from 'path';

type ExternalIdempotencyState = {
  processed: Record<string, string>;
};

const STATE_FILE = path.resolve(__dirname, '../../data/external-idempotency.json');
const EMPTY_STATE: ExternalIdempotencyState = { processed: {} };
const processedEventStore = new Map<string, string>();
let loaded = false;

function ensureStateDirExists(): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
}

function loadStateFromDisk(): ExternalIdempotencyState {
  ensureStateDirExists();

  if (!fs.existsSync(STATE_FILE)) {
    return EMPTY_STATE;
  }

  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    if (!raw.trim()) {
      return EMPTY_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<ExternalIdempotencyState>;
    return {
      processed: parsed.processed && typeof parsed.processed === 'object'
        ? parsed.processed
        : {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

function flushStateToDisk(): void {
  ensureStateDirExists();

  const state: ExternalIdempotencyState = {
    processed: Object.fromEntries(processedEventStore),
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function ensureLoaded(): void {
  if (loaded) {
    return;
  }

  const state = loadStateFromDisk();
  processedEventStore.clear();

  for (const [key, value] of Object.entries(state.processed)) {
    processedEventStore.set(key, value);
  }

  loaded = true;
}

function makeKey(workspaceId: string, externalEventId: string): string {
  return `${workspaceId}::${externalEventId}`;
}

export function hasProcessedExternalEvent(workspaceId: string, externalEventId: string): boolean {
  ensureLoaded();
  return processedEventStore.has(makeKey(workspaceId, externalEventId));
}

export function markExternalEventProcessed(workspaceId: string, externalEventId: string): void {
  ensureLoaded();
  processedEventStore.set(makeKey(workspaceId, externalEventId), new Date().toISOString());
  flushStateToDisk();
}

export function resetExternalIdempotencyStoreForTests(): void {
  ensureLoaded();
  processedEventStore.clear();
  loaded = false;
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.rmSync(STATE_FILE, { force: true });
    }
  } catch {
    // no-op for test cleanup
  }
}
