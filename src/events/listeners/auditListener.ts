/**
 * AUDIT LISTENER
 *
 * Registra todos os eventos financeiros emitidos no auditLogService,
 * garantindo rastro de auditoria para operações críticas.
 */

import { subscribeToFinancialEvents } from '../eventEngine';
import { logAuditEvent } from '../../security/auditLogService';

export function registerAuditListener(): () => void {
  return subscribeToFinancialEvents((event) => {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const entityId = (payload.id as string) ?? (payload.transactionId as string) ?? event.id;
    const userId   = (payload.userId as string) ?? 'system';

    logAuditEvent(
      event.type,
      'financial_event',
      entityId,
      { source: 'event_bus', userId, event_id: event.id, created_at: event.created_at },
    );
  });
}
