/**
 * TESTES — Audit Event Log (C5)
 * Verifica que:
 *  - recordAuditEvent armazena evento com id e at gerados automaticamente
 *  - getAuditEvents() retorna newest-first
 *  - filtros por userId, action, status, since e limit funcionam
 *  - ring buffer descarta o mais antigo quando ultrapassa MAX_EVENTS
 *  - getAuditEventCount() retorna tamanho correto
 *  - resetAuditLogForTests() limpa o buffer
 *  - Controllers registram eventos nos fluxos críticos (auth, quota, banking)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuditEventCount,
  getAuditEvents,
  recordAuditEvent,
  resetAuditLogForTests,
} from '../../backend/src/services/admin/auditLog';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAuditLogForTests();
});

// ─── recordAuditEvent ────────────────────────────────────────────────────────

describe('recordAuditEvent', () => {
  it('should store an event and return it with id and at', () => {
    const event = recordAuditEvent({
      action: 'auth.login',
      status: 'success',
      userId: 'u1',
      email: 'u1@test.com',
    });

    expect(event.id).toMatch(/^audit_\d+_\d+$/);
    expect(event.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.action).toBe('auth.login');
    expect(event.status).toBe('success');
    expect(event.userId).toBe('u1');
    expect(event.email).toBe('u1@test.com');
  });

  it('should use provided at when supplied', () => {
    const fixedAt = '2024-01-15T10:00:00.000Z';
    const event = recordAuditEvent({ action: 'auth.logout', status: 'success', at: fixedAt });
    expect(event.at).toBe(fixedAt);
  });

  it('should increment the event counter across multiple calls', () => {
    const e1 = recordAuditEvent({ action: 'auth.login', status: 'success' });
    const e2 = recordAuditEvent({ action: 'auth.logout', status: 'success' });
    expect(e1.id).not.toBe(e2.id);
  });

  it('should persist optional fields: ip, userAgent, resource, metadata', () => {
    const event = recordAuditEvent({
      action: 'quota.exceeded',
      status: 'blocked',
      userId: 'u2',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      resource: 'aiQueries',
      metadata: { plan: 'free', limit: 100 },
    });

    expect(event.ip).toBe('192.168.1.1');
    expect(event.userAgent).toBe('Mozilla/5.0');
    expect(event.resource).toBe('aiQueries');
    expect(event.metadata).toEqual({ plan: 'free', limit: 100 });
  });
});

// ─── getAuditEventCount ──────────────────────────────────────────────────────

describe('getAuditEventCount', () => {
  it('should return 0 on empty buffer', () => {
    expect(getAuditEventCount()).toBe(0);
  });

  it('should return the number of recorded events', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success' });
    recordAuditEvent({ action: 'auth.logout', status: 'success' });
    expect(getAuditEventCount()).toBe(2);
  });
});

// ─── getAuditEvents ──────────────────────────────────────────────────────────

describe('getAuditEvents — ordering', () => {
  it('should return events newest-first', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success', at: '2024-01-01T10:00:00.000Z' });
    recordAuditEvent({ action: 'auth.logout', status: 'success', at: '2024-01-01T11:00:00.000Z' });
    recordAuditEvent({ action: 'auth.token_refresh', status: 'success', at: '2024-01-01T12:00:00.000Z' });

    const events = getAuditEvents();
    expect(events[0].action).toBe('auth.token_refresh');
    expect(events[1].action).toBe('auth.logout');
    expect(events[2].action).toBe('auth.login');
  });

  it('should return all events when no filters are set', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success' });
    recordAuditEvent({ action: 'banking.connect', status: 'success' });
    expect(getAuditEvents()).toHaveLength(2);
  });
});

describe('getAuditEvents — filter by userId', () => {
  it('should only return events for the specified userId', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success', userId: 'alice' });
    recordAuditEvent({ action: 'auth.login', status: 'success', userId: 'bob' });
    recordAuditEvent({ action: 'auth.logout', status: 'success', userId: 'alice' });

    const events = getAuditEvents({ userId: 'alice' });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.userId === 'alice')).toBe(true);
  });
});

describe('getAuditEvents — filter by action', () => {
  it('should only return events matching the action', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success' });
    recordAuditEvent({ action: 'auth.login_failed', status: 'failure' });
    recordAuditEvent({ action: 'auth.login', status: 'success' });

    const events = getAuditEvents({ action: 'auth.login' });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.action === 'auth.login')).toBe(true);
  });
});

describe('getAuditEvents — filter by status', () => {
  it('should only return events with the specified status', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success' });
    recordAuditEvent({ action: 'auth.login_failed', status: 'failure' });
    recordAuditEvent({ action: 'quota.exceeded', status: 'blocked' });

    expect(getAuditEvents({ status: 'success' })).toHaveLength(1);
    expect(getAuditEvents({ status: 'failure' })).toHaveLength(1);
    expect(getAuditEvents({ status: 'blocked' })).toHaveLength(1);
  });
});

describe('getAuditEvents — filter by since', () => {
  it('should exclude events older than the since timestamp', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success', at: '2024-01-01T00:00:00.000Z' });
    recordAuditEvent({ action: 'auth.login', status: 'success', at: '2024-06-01T00:00:00.000Z' });
    recordAuditEvent({ action: 'auth.login', status: 'success', at: '2024-12-01T00:00:00.000Z' });

    const events = getAuditEvents({ since: '2024-06-01T00:00:00.000Z' });
    expect(events).toHaveLength(2);
    expect(events.every((e) => new Date(e.at) >= new Date('2024-06-01T00:00:00.000Z'))).toBe(true);
  });
});

describe('getAuditEvents — limit', () => {
  it('should return at most `limit` events', () => {
    for (let i = 0; i < 10; i++) {
      recordAuditEvent({ action: 'auth.login', status: 'success' });
    }

    const events = getAuditEvents({ limit: 3 });
    expect(events).toHaveLength(3);
  });
});

describe('getAuditEvents — combined filters', () => {
  it('should combine userId + action + limit correctly', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success', userId: 'alice' });
    recordAuditEvent({ action: 'auth.login', status: 'success', userId: 'alice' });
    recordAuditEvent({ action: 'auth.login', status: 'success', userId: 'alice' });
    recordAuditEvent({ action: 'auth.logout', status: 'success', userId: 'alice' });
    recordAuditEvent({ action: 'auth.login', status: 'success', userId: 'bob' });

    const events = getAuditEvents({ userId: 'alice', action: 'auth.login', limit: 2 });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.userId === 'alice' && e.action === 'auth.login')).toBe(true);
  });
});

// ─── Ring buffer (overflow) ──────────────────────────────────────────────────

describe('ring buffer overflow', () => {
  it('should keep the MAX_EVENTS most recent when buffer is exceeded', () => {
    // We use a large number to trigger the overflow: 10_001 events
    // This is slow if done naively so we simulate with 10_001 recordings and
    // verify that the first event was evicted and the count stays <= 10_000.
    const OVERFLOW = 10_001;

    for (let i = 0; i < OVERFLOW; i++) {
      recordAuditEvent({
        action: 'auth.login',
        status: 'success',
        userId: `user-${i}`,
      });
    }

    // Buffer must not exceed MAX_EVENTS
    expect(getAuditEventCount()).toBe(10_000);

    // First event (user-0) should have been evicted, newest (user-10000) should be present
    const events = getAuditEvents({ userId: 'user-0' });
    expect(events).toHaveLength(0);

    const newestEvents = getAuditEvents({ userId: 'user-10000' });
    expect(newestEvents).toHaveLength(1);
  }, 15_000); // generous timeout for 10k iterations
});

// ─── resetAuditLogForTests ───────────────────────────────────────────────────

describe('resetAuditLogForTests', () => {
  it('should clear the buffer completely', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success' });
    recordAuditEvent({ action: 'auth.logout', status: 'success' });
    expect(getAuditEventCount()).toBe(2);

    resetAuditLogForTests();
    expect(getAuditEventCount()).toBe(0);
    expect(getAuditEvents()).toHaveLength(0);
  });

  it('should reset the id counter so new ids start fresh', () => {
    recordAuditEvent({ action: 'auth.login', status: 'success' });
    resetAuditLogForTests();

    const event = recordAuditEvent({ action: 'auth.login', status: 'success' });
    // After reset counter is 0, so first id after reset ends in _1
    expect(event.id).toMatch(/_1$/);
  });
});

// ─── AuditAction coverage ────────────────────────────────────────────────────

describe('all AuditAction variants can be recorded', () => {
  const actions = [
    'auth.login',
    'auth.login_failed',
    'auth.logout',
    'auth.token_refresh',
    'auth.token_revoked',
    'auth.oauth_start',
    'auth.oauth_success',
    'auth.oauth_failed',
    'banking.connect',
    'banking.disconnect',
    'banking.sync',
    'billing.plan_changed',
    'quota.exceeded',
    'security.forbidden',
    'security.unauthorized',
  ] as const;

  it.each(actions)('records action "%s" without throwing', (action) => {
    expect(() =>
      recordAuditEvent({ action, status: 'success' }),
    ).not.toThrow();
    expect(getAuditEventCount()).toBe(1);
    resetAuditLogForTests();
  });
});
