import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { AppError } from '../../shared/AppError';
import logger from '../../config/logger';
import {
  initializePostgresStateStore,
  insertDomainEvent,
  isPostgresStateStoreEnabled,
  PersistedDomainEventRow,
  queryDomainEvents,
} from '../persistence/postgresStateStore';
import {
  appendDomainEventToFirestore,
  getDomainEventFirestoreStatus,
  queryDomainEventsFromFirestore,
} from './eventStoreFirestore';

export type DomainEventRecord = PersistedDomainEventRow;

type DomainEventPersistenceMode = 'postgres' | 'firebase' | 'legacy-file';

export interface DomainEventPersistenceHealthCheck {
  status: 'healthy' | 'unhealthy';
  mode: DomainEventPersistenceMode;
  durable: boolean;
  configured: boolean;
  required: boolean;
  reason: string;
}

type EventStoreFileState = {
  events: DomainEventRecord[];
};

const DEFAULT_STORE_FILE = path.resolve(__dirname, '../../../data/domain-events.json');
const EMPTY_STATE: EventStoreFileState = { events: [] };
let stateCache: EventStoreFileState | null = null;

function getStoreFilePath(): string {
  return process.env.DOMAIN_EVENT_STORE_FILE || DEFAULT_STORE_FILE;
}

function isDurableDomainEventPersistenceRequired(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function ensureStoreDirExists(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function cloneState(state: EventStoreFileState): EventStoreFileState {
  return {
    events: state.events.map((event) => ({
      ...event,
      payload: event.payload ? { ...event.payload } : undefined,
      metadata: event.metadata ? { ...event.metadata } : undefined,
    })),
  };
}

function loadLocalState(): EventStoreFileState {
  if (stateCache) {
    return stateCache;
  }

  const filePath = getStoreFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      ensureStoreDirExists(filePath);
      stateCache = cloneState(EMPTY_STATE);
      return stateCache;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      stateCache = cloneState(EMPTY_STATE);
      return stateCache;
    }

    const parsed = JSON.parse(raw) as Partial<EventStoreFileState>;
    stateCache = {
      events: Array.isArray(parsed.events) ? parsed.events as DomainEventRecord[] : [],
    };
  } catch (error) {
    logger.warn({
      error,
      filePath,
      fallback: 'domain-event-store-load-failed',
    }, 'Failed to load domain event store, starting empty');
    stateCache = cloneState(EMPTY_STATE);
  }

  return stateCache;
}

function persistLocalState(state: EventStoreFileState): void {
  stateCache = cloneState(state);
  const filePath = getStoreFilePath();
  try {
    ensureStoreDirExists(filePath);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    logger.error({
      error,
      filePath,
      eventCount: state.events.length,
      fallback: 'domain-event-store-persist-failed',
    }, 'Failed to persist domain event store');
    throw error;
  }
}

export async function getDomainEventPersistenceHealthCheck(): Promise<DomainEventPersistenceHealthCheck> {
  const required = isDurableDomainEventPersistenceRequired();

  if (isPostgresStateStoreEnabled()) {
    const ready = await initializePostgresStateStore();
    if (ready) {
      return {
        status: 'healthy',
        mode: 'postgres',
        durable: true,
        configured: true,
        required,
        reason: 'postgres-ready',
      };
    }
  }

  const firestore = await getDomainEventFirestoreStatus();
  if (firestore.ready) {
    return {
      status: 'healthy',
      mode: 'firebase',
      durable: true,
      configured: true,
      required,
      reason: isPostgresStateStoreEnabled() ? 'postgres-unavailable-fallback-firebase' : 'firebase-ready',
    };
  }

  if (firestore.configured) {
    return {
      status: required ? 'unhealthy' : 'healthy',
      mode: 'firebase',
      durable: false,
      configured: true,
      required,
      reason: 'firebase-unavailable',
    };
  }

  return {
    status: required ? 'unhealthy' : 'healthy',
    mode: 'legacy-file',
    durable: !required,
    configured: true,
    required,
    reason: required ? 'legacy-file-not-accepted-for-production' : 'legacy-file-local-only',
  };
}

export async function initializeDomainEventStorePersistence(): Promise<void> {
  await getDomainEventPersistenceHealthCheck();
}

export async function appendDomainEvent(input: Omit<DomainEventRecord, 'id'> & { id?: string }): Promise<DomainEventRecord> {
  const event: DomainEventRecord = {
    ...input,
    id: input.id || randomUUID(),
  };

  if (isPostgresStateStoreEnabled()) {
    await insertDomainEvent(event);
    return event;
  }

  const firestore = await getDomainEventFirestoreStatus();
  if (firestore.ready) {
    await appendDomainEventToFirestore(event);
    return event;
  }

  const persistence = await getDomainEventPersistenceHealthCheck();
  if (persistence.required && !persistence.durable) {
    logger.error({
      persistence,
      workspaceId: event.workspaceId,
      eventType: event.type,
      fallback: 'domain-event-store-durable-persistence-required',
    }, 'Rejected domain event write because durable persistence is unavailable');
    throw new AppError(503, 'Persistencia duravel de eventos indisponivel');
  }

  const state = loadLocalState();
  persistLocalState({
    events: [event, ...state.events].slice(0, 5000),
  });
  return event;
}

export async function getDomainEvents(filters: {
  workspaceId: string;
  aggregateId?: string;
  aggregateType?: string;
  type?: string;
  userId?: string;
  since?: string;
  until?: string;
  limit?: number;
}): Promise<DomainEventRecord[]> {
  if (isPostgresStateStoreEnabled()) {
    return queryDomainEvents(filters);
  }

  const firestore = await getDomainEventFirestoreStatus();
  if (firestore.ready) {
    return queryDomainEventsFromFirestore(filters);
  }

  const persistence = await getDomainEventPersistenceHealthCheck();
  if (persistence.required && !persistence.durable) {
    logger.error({
      persistence,
      workspaceId: filters.workspaceId,
      aggregateType: filters.aggregateType,
      eventType: filters.type,
      fallback: 'domain-event-store-read-durable-persistence-required',
    }, 'Rejected domain event read because durable persistence is unavailable');
    throw new AppError(503, 'Persistencia duravel de eventos indisponivel');
  }

  let events = loadLocalState().events.filter((event) => event.workspaceId === filters.workspaceId);

  if (filters.aggregateId) {
    events = events.filter((event) => event.aggregateId === filters.aggregateId);
  }
  if (filters.aggregateType) {
    events = events.filter((event) => event.aggregateType === filters.aggregateType);
  }
  if (filters.type) {
    events = events.filter((event) => event.type === filters.type);
  }
  if (filters.userId) {
    events = events.filter((event) => event.userId === filters.userId);
  }
  if (filters.since) {
    const since = new Date(filters.since).getTime();
    events = events.filter((event) => new Date(event.occurredAt).getTime() >= since);
  }
  if (filters.until) {
    const until = new Date(filters.until).getTime();
    events = events.filter((event) => new Date(event.occurredAt).getTime() <= until);
  }

  return events
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, filters.limit || 100);
}

export function resetDomainEventStoreForTests(): void {
  stateCache = cloneState(EMPTY_STATE);
  const filePath = getStoreFilePath();
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}
