/**
 * AUDIT LOG SERVICE — Registro de auditoria
 *
 * Registra todas as operações críticas para auditoria e integridade.
 */

import { logInfo } from '../utils/logger';
import { hasAuditLogPersistenceContext, persistAuditEvent } from './auditLogPersistence';
import type { AuditLogEntry, AuditLogPersistenceContext } from './auditLogTypes';

export type { AuditLogEntry, AuditLogPersistenceContext } from './auditLogTypes';

const MAX_AUDIT_LOG_CACHE = 200;
const auditLogs: AuditLogEntry[] = [];

// Cache local curto para diagnóstico; a fonte de verdade é o Firestore.
function pushAuditLogCache(entry: AuditLogEntry): void {
  auditLogs.push(entry);

  if (auditLogs.length > MAX_AUDIT_LOG_CACHE) {
    auditLogs.splice(0, auditLogs.length - MAX_AUDIT_LOG_CACHE);
  }
}

/**
 * Registra um evento de auditoria.
 */
export function logAuditEvent(
  eventType: string,
  entity: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  context?: AuditLogPersistenceContext,
): void {
  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    event_type: eventType,
    entity,
    entity_id: entityId,
    metadata,
    timestamp: new Date().toISOString(),
  };

  pushAuditLogCache(entry);
  logInfo('[Audit] recorded event', {
    eventType,
    entity,
    entityId,
    metadata,
    persistence: hasAuditLogPersistenceContext(context) ? 'firestore' : 'local-cache-only',
    fallback: 'audit-log-event-recorded',
  });

  if (!hasAuditLogPersistenceContext(context)) {
    return;
  }

  logInfo('[Audit] dispatching persistence', {
    eventId: entry.id,
    eventType,
    entity,
    entityId,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    userId: context.userId,
    fallback: 'audit-log-persistence-dispatched',
  });

  void persistAuditEvent(context.tenantId, context.workspaceId, context.userId, entry);
}

/**
 * Obtém logs de auditoria filtrados.
 */
export function getAuditLogs(
  entity?: string,
  eventType?: string,
  limit = 100,
): AuditLogEntry[] {
  let filtered = auditLogs;

  if (entity) {
    filtered = filtered.filter((log) => log.entity === entity);
  }

  if (eventType) {
    filtered = filtered.filter((log) => log.event_type === eventType);
  }

  return filtered.slice(-limit);
}

/**
 * Eventos padrão
 */
export const AUDIT_EVENTS = {
  TRANSACTION_CREATED: 'transaction_created',
  TRANSACTION_DELETED: 'transaction_deleted',
  BANK_SYNC: 'bank_sync',
  GOAL_CREATED: 'goal_created',
  USER_LOGIN: 'user_login',
  SETTINGS_CHANGED: 'settings_changed',
} as const;
