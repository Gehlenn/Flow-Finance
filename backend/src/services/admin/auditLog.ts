/**
 * Audit Event Log — ring buffer in-memory para rastreio de eventos de segurança.
 *
 * Registra: login, logout, token refresh, oauth, connect/disconnect bancário,
 * falhas de autenticação e violações de quota.
 *
 * O buffer mantém no máximo `MAX_EVENTS` entradas. Quando cheio, os eventos
 * mais antigos são descartados (FIFO).
 */

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.token_refresh'
  | 'auth.token_revoked'
  | 'auth.oauth_start'
  | 'auth.oauth_success'
  | 'auth.oauth_failed'
  | 'banking.connect'
  | 'banking.disconnect'
  | 'banking.sync'
  | 'billing.plan_changed'
  | 'quota.exceeded'
  | 'security.forbidden'
  | 'security.unauthorized';

export type AuditStatus = 'success' | 'failure' | 'blocked';

export interface AuditEvent {
  id: string;
  userId?: string;
  email?: string;
  action: AuditAction;
  status: AuditStatus;
  ip?: string;
  userAgent?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
  at: string; // ISO 8601
}

const MAX_EVENTS = 10_000;
let eventBuffer: AuditEvent[] = [];
let eventCounter = 0;

function generateEventId(): string {
  eventCounter += 1;
  return `audit_${Date.now()}_${eventCounter}`;
}

/**
 * Records an audit event. Thread-safe within Node's single-threaded model.
 */
export function recordAuditEvent(
  event: Omit<AuditEvent, 'id' | 'at'> & { at?: string },
): AuditEvent {
  const full: AuditEvent = {
    ...event,
    id: generateEventId(),
    at: event.at ?? new Date().toISOString(),
  };

  eventBuffer.push(full);

  if (eventBuffer.length > MAX_EVENTS) {
    // Drop the oldest entry
    eventBuffer.shift();
  }

  return full;
}

/**
 * Query recent audit events with optional filters.
 */
export function getAuditEvents(filters: {
  userId?: string;
  action?: AuditAction;
  status?: AuditStatus;
  limit?: number;
  since?: string; // ISO 8601
} = {}): AuditEvent[] {
  let result = eventBuffer;

  if (filters.userId) {
    result = result.filter((e) => e.userId === filters.userId);
  }

  if (filters.action) {
    result = result.filter((e) => e.action === filters.action);
  }

  if (filters.status) {
    result = result.filter((e) => e.status === filters.status);
  }

  if (filters.since) {
    const sinceMs = new Date(filters.since).getTime();
    result = result.filter((e) => new Date(e.at).getTime() >= sinceMs);
  }

  // Return newest first
  const reversed = [...result].reverse();
  return filters.limit ? reversed.slice(0, filters.limit) : reversed;
}

export function getAuditEventCount(): number {
  return eventBuffer.length;
}

/** For tests only — resets the buffer. */
export function resetAuditLogForTests(): void {
  eventBuffer = [];
  eventCounter = 0;
}
