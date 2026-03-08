/**
 * AUDIT LOG SERVICE — Registro de auditoria
 *
 * Registra todas as operações críticas para auditoria e integridade.
 */

export interface AuditLogEntry {
  id: string;
  event_type: string;
  entity: string;
  entity_id: string;
  metadata: Record<string, any>;
  timestamp: string;
}

const auditLogs: AuditLogEntry[] = [];

/**
 * Registra um evento de auditoria.
 */
export function logAuditEvent(
  eventType: string,
  entity: string,
  entityId: string,
  metadata: Record<string, any> = {}
): void {
  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    event_type: eventType,
    entity,
    entity_id: entityId,
    metadata,
    timestamp: new Date().toISOString(),
  };

  auditLogs.push(entry);
  console.log(`[AUDIT] ${eventType}: ${entity} ${entityId}`, metadata);
}

/**
 * Obtém logs de auditoria filtrados.
 */
export function getAuditLogs(
  entity?: string,
  eventType?: string,
  limit = 100
): AuditLogEntry[] {
  let filtered = auditLogs;

  if (entity) {
    filtered = filtered.filter(log => log.entity === entity);
  }

  if (eventType) {
    filtered = filtered.filter(log => log.event_type === eventType);
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