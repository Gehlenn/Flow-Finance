import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getFirestoreOrNull, isFirebaseConfigured } from '../../utils/firestoreAdmin';
import type { DomainEventRecord } from './eventStoreTypes';

const COLLECTION = 'domain_events';
const DEFAULT_BATCH_SIZE = 250;
const MAX_SCAN_DOCS = 5000;

type DomainEventQueryFilters = {
  workspaceId: string;
  aggregateId?: string;
  aggregateType?: string;
  type?: string;
  userId?: string;
  since?: string;
  until?: string;
  limit?: number;
};

async function getDb(): Promise<Firestore | null> {
  return getFirestoreOrNull('DomainEventStore');
}

function eventCollection(db: Firestore) {
  return db.collection(COLLECTION);
}

function mapDomainEventRecord(
  docId: string,
  data: Record<string, unknown>,
): DomainEventRecord {
  return {
    id: typeof data.id === 'string' && data.id.trim().length > 0 ? data.id : docId,
    workspaceId: String(data.workspaceId || ''),
    tenantId: typeof data.tenantId === 'string' ? data.tenantId : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    aggregateId: typeof data.aggregateId === 'string' ? data.aggregateId : undefined,
    aggregateType: typeof data.aggregateType === 'string' ? data.aggregateType : undefined,
    type: String(data.type || ''),
    payload: data.payload && typeof data.payload === 'object' ? data.payload as Record<string, unknown> : undefined,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : undefined,
    occurredAt: String(data.occurredAt || ''),
  };
}

function matchesFilters(event: DomainEventRecord, filters: DomainEventQueryFilters): boolean {
  if (event.workspaceId !== filters.workspaceId) {
    return false;
  }

  if (filters.aggregateId && event.aggregateId !== filters.aggregateId) {
    return false;
  }

  if (filters.aggregateType && event.aggregateType !== filters.aggregateType) {
    return false;
  }

  if (filters.type && event.type !== filters.type) {
    return false;
  }

  if (filters.userId && event.userId !== filters.userId) {
    return false;
  }

  if (filters.since && event.occurredAt < filters.since) {
    return false;
  }

  if (filters.until && event.occurredAt > filters.until) {
    return false;
  }

  return true;
}

function requiresInMemoryFiltering(filters: DomainEventQueryFilters): boolean {
  return Boolean(
    filters.aggregateId
      || filters.aggregateType
      || filters.type
      || filters.userId
      || filters.since
      || filters.until,
  );
}

export async function getDomainEventFirestoreStatus(): Promise<{
  configured: boolean;
  ready: boolean;
}> {
  if (!isFirebaseConfigured()) {
    return { configured: false, ready: false };
  }

  const db = await getDb();
  return { configured: true, ready: db !== null };
}

export async function appendDomainEventToFirestore(event: DomainEventRecord): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Firestore domain event store unavailable');
  }

  await eventCollection(db).doc(event.id).set({
    ...event,
    createdAt: new Date().toISOString(),
  }, { merge: true });
}

export async function queryDomainEventsFromFirestore(
  filters: DomainEventQueryFilters,
): Promise<DomainEventRecord[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const requestedLimit = Math.max(1, Math.min(filters.limit || 100, 500));
  const baseQuery = eventCollection(db).where('workspaceId', '==', filters.workspaceId);

  if (!requiresInMemoryFiltering(filters)) {
    const snapshot = await baseQuery.limit(requestedLimit).get();
    return snapshot.docs
      .map((doc) => mapDomainEventRecord(doc.id, (doc.data() || {}) as Record<string, unknown>))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, requestedLimit);
  }

  const matches: DomainEventRecord[] = [];
  let cursor: QueryDocumentSnapshot | undefined;
  let scanned = 0;

  while (matches.length < requestedLimit && scanned < MAX_SCAN_DOCS) {
    let query = baseQuery.limit(DEFAULT_BATCH_SIZE);
    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      const event = mapDomainEventRecord(doc.id, (doc.data() || {}) as Record<string, unknown>);
      scanned += 1;

      if (matchesFilters(event, filters)) {
        matches.push(event);
        if (matches.length >= requestedLimit) {
          break;
        }
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < DEFAULT_BATCH_SIZE) {
      break;
    }
  }

  return matches
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, requestedLimit);
}
