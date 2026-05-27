import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { logError } from '../utils/logger';
import type { AuditLogEntry, AuditLogPersistenceContext } from './auditLogService';

export interface PersistAuditEventOptions {
  dbInstance?: Firestore | null;
}

export async function persistAuditEvent(
  tenantId: string,
  workspaceId: string,
  userId: string,
  entry: AuditLogEntry,
  options: PersistAuditEventOptions = {},
): Promise<void> {
  const dbInstance = options.dbInstance ?? db;

  if (!dbInstance) {
    return;
  }

  try {
    await addDoc(collection(dbInstance, 'audit_logs', tenantId, 'events'), {
      id: entry.id,
      tenantId,
      workspaceId,
      userId,
      event_type: entry.event_type,
      entity: entry.entity,
      entity_id: entry.entity_id,
      action: entry.event_type,
      resourceType: entry.entity,
      resourceId: entry.entity_id,
      metadata: entry.metadata,
      timestamp: entry.timestamp,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    logError('[Audit] failed to persist event', error, {
      tenantId,
      workspaceId,
      userId,
      eventId: entry.id,
      eventType: entry.event_type,
      fallback: 'audit-log-persist-failed',
    });
  }
}

export function hasAuditLogPersistenceContext(
  context?: Partial<AuditLogPersistenceContext> | null,
): context is AuditLogPersistenceContext {
  return Boolean(
    context?.tenantId?.trim()
      && context.workspaceId?.trim()
      && context.userId?.trim(),
  );
}
