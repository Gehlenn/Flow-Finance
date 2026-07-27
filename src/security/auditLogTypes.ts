export interface AuditLogEntry {
  id: string;
  event_type: string;
  entity: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface AuditLogPersistenceContext {
  tenantId: string;
  workspaceId: string;
  userId: string;
}
