import { collection, doc, getDocs, limit, orderBy, type QueryConstraint, startAfter, query, setDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import type { AuditLogCursor, AuditLogDocument } from './firestoreWorkspaceTypes';

const FIREBASE_WORKSPACE_CONFIG_ERROR = new Error('Workspace sync requires Firebase configuration.');

function nowIso(): string {
  return new Date().toISOString();
}

function hasWorkspaceContext(workspaceId?: string, tenantId?: string): boolean {
  return Boolean(workspaceId?.trim()) && Boolean(tenantId?.trim());
}

function auditEventCollection(tenantId: string) {
  return collection(db, 'audit_logs', tenantId, 'events');
}

export async function writeAuditLogEvent(event: Omit<AuditLogDocument, 'id' | 'createdAt'>): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }

  const eventRef = doc(collection(db, 'audit_logs', event.tenantId, 'events'));
  await setDoc(eventRef, {
    id: eventRef.id,
    ...event,
    createdAt: nowIso(),
  } satisfies AuditLogDocument);
}

export async function listWorkspaceAuditEvents(input: {
  tenantId: string;
  workspaceId: string;
  maxItems?: number;
  fromDate?: string;
  toDate?: string;
  resourceType?: string;
}): Promise<AuditLogDocument[]> {
  const page = await listWorkspaceAuditEventsPage(input);
  return page.events;
}

export async function listWorkspaceAuditEventsPage(input: {
  tenantId: string;
  workspaceId: string;
  maxItems?: number;
  fromDate?: string;
  toDate?: string;
  resourceType?: string;
  after?: AuditLogCursor | null;
}): Promise<{ events: AuditLogDocument[]; nextCursor: AuditLogCursor | null }> {
  if (!isFirebaseConfigured || !hasWorkspaceContext(input.workspaceId, input.tenantId)) {
    return { events: [], nextCursor: null };
  }

  const constraints: QueryConstraint[] = [
    where('workspaceId', '==', input.workspaceId),
  ];

  if (input.resourceType) {
    constraints.push(where('resourceType', '==', input.resourceType));
  }

  if (input.fromDate) {
    constraints.push(where('createdAt', '>=', input.fromDate));
  }

  if (input.toDate) {
    constraints.push(where('createdAt', '<=', input.toDate));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(orderBy('id', 'desc'));
  if (input.after) {
    constraints.push(startAfter(input.after.createdAt, input.after.id));
  }
  constraints.push(limit(input.maxItems || 25));

  const snapshot = await getDocs(query(
    auditEventCollection(input.tenantId),
    ...constraints,
  ));

  const events = snapshot.docs.map((auditSnapshot) => auditSnapshot.data() as AuditLogDocument);
  const nextCursor = events.length === (input.maxItems || 25)
    ? {
      createdAt: events[events.length - 1]?.createdAt || '',
      id: events[events.length - 1]?.id || '',
    }
    : null;

  return {
    events,
    nextCursor,
  };
}
