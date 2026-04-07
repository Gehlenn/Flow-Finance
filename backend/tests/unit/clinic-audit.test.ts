import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { clinicAuditMiddleware, recordClinicAuditEvent, getClinicAuditMetrics, resetClinicAuditMetricsForTests } from '../../src/middleware/clinicAudit';

describe('Clinic Audit Middleware', () => {
  beforeEach(() => {
    resetClinicAuditMetricsForTests();
  });

  afterEach(() => {
    resetClinicAuditMetricsForTests();
  });

  it('deve registrar evento de auditoria com todos os campos obrigatórios', () => {
    recordClinicAuditEvent({
      timestamp: new Date().toISOString(),
      requestId: 'req-123',
      sourceIp: '192.168.1.1',
      integrationKey: 'clinic-key-001',
      externalEventId: 'evt_001',
      eventType: 'payment_received',
      workspaceId: 'workspace-clinic-01',
      statusCode: 202,
      resultType: 'success',
      durationMs: 145,
    });

    const metrics = getClinicAuditMetrics();

    expect(metrics.totalEvents).toBe(1);
    expect(metrics.successCount).toBe(1);
    expect(metrics.latencies.count).toBe(1);
    expect(metrics.latencies.mean).toBe(145);
    expect(metrics.latencies.p95).toBe(145);
  });

  it('deve classificar corretamente eventos de sucesso vs duplicata vs falha', () => {
    recordClinicAuditEvent({
      timestamp: new Date().toISOString(),
      requestId: 'req-1',
      sourceIp: '127.0.0.1',
      integrationKey: 'key-a',
      externalEventId: 'evt_002_success',
      eventType: 'payment_received',
      workspaceId: 'ws-1',
      statusCode: 202,
      resultType: 'success',
      durationMs: 100,
    });

    recordClinicAuditEvent({
      timestamp: new Date().toISOString(),
      requestId: 'req-2',
      sourceIp: '127.0.0.1',
      integrationKey: 'key-a',
      externalEventId: 'evt_003_dup',
      eventType: 'payment_received',
      workspaceId: 'ws-1',
      statusCode: 200,
      resultType: 'duplicate',
      durationMs: 50,
    });

    recordClinicAuditEvent({
      timestamp: new Date().toISOString(),
      requestId: 'req-3',
      sourceIp: '127.0.0.1',
      integrationKey: 'key-b',
      externalEventId: 'evt_004_auth',
      eventType: 'payment_received',
      workspaceId: 'ws-1',
      statusCode: 401,
      resultType: 'invalid_auth',
      durationMs: 20,
      reason: 'Invalid signature',
    });

    const metrics = getClinicAuditMetrics();

    expect(metrics.totalEvents).toBe(3);
    expect(metrics.successCount).toBe(1);
    expect(metrics.duplicateCount).toBe(1);
    expect(metrics.authFailureCount).toBe(1);
  });

  it('deve calcular p95 e p99 de latências corretamente', () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    latencies.forEach((lat, i) => {
      recordClinicAuditEvent({
        timestamp: new Date().toISOString(),
        requestId: `req-${i}`,
        sourceIp: '127.0.0.1',
        integrationKey: 'key-test',
        externalEventId: `evt_${i}`,
        eventType: 'payment_received',
        workspaceId: 'ws-test',
        statusCode: 202,
        resultType: 'success',
        durationMs: lat,
      });
    });

    const metrics = getClinicAuditMetrics();

    expect(metrics.latencies.count).toBe(10);
    expect(metrics.latencies.min).toBe(10);
    expect(metrics.latencies.max).toBe(100);
    expect(metrics.latencies.p95).toBeGreaterThanOrEqual(85);
    expect(metrics.latencies.p99).toBeGreaterThanOrEqual(85);
  });

  it('deve limitar histórico em memória a 1000 eventos', () => {
    for (let i = 0; i < 1100; i++) {
      recordClinicAuditEvent({
        timestamp: new Date().toISOString(),
        requestId: `req-${i}`,
        sourceIp: '127.0.0.1',
        integrationKey: 'key-test',
        externalEventId: `evt_${i}`,
        eventType: 'payment_received',
        workspaceId: 'ws-test',
        statusCode: 202,
        resultType: 'success',
        durationMs: 50,
      });
    }

    const metrics = getClinicAuditMetrics();

    // Pelo menos 1000 eventos foram registrados
    expect(metrics.totalEvents).toBe(1100);
    // Mas histórico em memória deve estar limitado a 1000
    expect(metrics.latencies.count).toBeLessThanOrEqual(1000);
  });

  it('deve contar falhas de authenticação e rate limit separadamente', () => {
    recordClinicAuditEvent({
      timestamp: new Date().toISOString(),
      requestId: 'req-auth-1',
      sourceIp: '192.168.1.2',
      integrationKey: 'bad-key',
      externalEventId: 'evt_bad_auth_1',
      eventType: 'expense_recorded',
      workspaceId: 'ws-2',
      statusCode: 401,
      resultType: 'invalid_auth',
      durationMs: 15,
      reason: 'Invalid API key',
    });

    recordClinicAuditEvent({
      timestamp: new Date().toISOString(),
      requestId: 'req-limit-1',
      sourceIp: '192.168.1.3',
      integrationKey: 'clinic-key',
      externalEventId: 'evt_rate_limited_1',
      eventType: 'payment_received',
      workspaceId: 'ws-3',
      statusCode: 429,
      resultType: 'rate_limited',
      durationMs: 10,
      reason: 'Rate limit exceeded',
    });

    const metrics = getClinicAuditMetrics();

    expect(metrics.authFailureCount).toBe(1);
    expect(metrics.rateLimitCount).toBe(1);
    expect(metrics.totalEvents).toBe(2);
  });
});
