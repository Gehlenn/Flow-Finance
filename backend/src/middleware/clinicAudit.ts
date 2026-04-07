import { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import logger from '../config/logger';
import { getRequestContextValue } from './requestContextStore';

export interface ClinicAuditEvent {
  timestamp: string;
  requestId: string;
  sourceIp: string;
  integrationKey: string;
  externalEventId: string;
  eventType: string;
  workspaceId: string;
  statusCode: number;
  resultType: 'success' | 'duplicate' | 'invalid_auth' | 'rate_limited' | 'validation_failed' | 'payload_oversized' | 'error';
  durationMs: number;
  reason?: string;
}

const auditEvents: ClinicAuditEvent[] = [];
const auditMetrics = {
  total: 0,
  success: 0,
  duplicate: 0,
  invalid_auth: 0,
  rate_limited: 0,
  validation_failed: 0,
  payload_oversized: 0,
  error: 0,
  latencies: [] as number[],
};

export function recordClinicAuditEvent(event: ClinicAuditEvent): void {
  auditEvents.push(event);
  
  // Manter histórico em memória limitado (últimas 1000 eventos)
  if (auditEvents.length > 1000) {
    auditEvents.shift();
  }

  // Atualizar métricas
  auditMetrics.total++;
  auditMetrics[event.resultType]++;
  auditMetrics.latencies.push(event.durationMs);

  // Manter histórico de latência limitado
  if (auditMetrics.latencies.length > 5000) {
    auditMetrics.latencies = auditMetrics.latencies.slice(-5000);
  }

  // Logs estruturados para cada tipo crítico
  if (event.statusCode === 401) {
    logger.warn(event, 'Clinic webhook auth failed');
    Sentry.captureMessage('Clinic webhook: invalid authentication', 'warning');
  } else if (event.statusCode === 429) {
    logger.warn(event, 'Clinic webhook rate limited');
    Sentry.captureMessage('Clinic webhook: rate limit exceeded', 'warning');
  } else if (event.resultType === 'duplicate') {
    logger.debug(event, 'Clinic webhook duplicate detected (idempotent response)');
  }
}

export function getClinicAuditMetrics() {
  const latencies = auditMetrics.latencies.sort((a, b) => a - b);
  const len = latencies.length;
  const p95 = len > 0 ? latencies[Math.floor(len * 0.95)] : 0;
  const p99 = len > 0 ? latencies[Math.floor(len * 0.99)] : 0;
  const mean = len > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / len) : 0;

  return {
    totalEvents: auditMetrics.total,
    successCount: auditMetrics.success,
    duplicateCount: auditMetrics.duplicate,
    authFailureCount: auditMetrics.invalid_auth,
    rateLimitCount: auditMetrics.rate_limited,
    validationFailureCount: auditMetrics.validation_failed,
    payloadOversizedCount: auditMetrics.payload_oversized,
    errorCount: auditMetrics.error,
    latencies: {
      mean,
      p95,
      p99,
      min: len > 0 ? latencies[0] : 0,
      max: len > 0 ? latencies[len - 1] : 0,
      count: len,
    },
  };
}

export function getClinicAuditLog() {
  return [...auditEvents];
}

export function resetClinicAuditMetricsForTests(): void {
  auditEvents.length = 0;
  auditMetrics.total = 0;
  auditMetrics.success = 0;
  auditMetrics.duplicate = 0;
  auditMetrics.invalid_auth = 0;
  auditMetrics.rate_limited = 0;
  auditMetrics.validation_failed = 0;
  auditMetrics.payload_oversized = 0;
  auditMetrics.error = 0;
  auditMetrics.latencies = [];
}

/**
 * Middleware para capturar auditoria de eventos de integração clínica.
 * Deve ser posicionado antes de middlewares de validação/auth para capturar erros.
 */
export function clinicAuditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const sourceIp = (req.ip || req.socket?.remoteAddress || 'unknown').replace('::ffff:', '');
  const integrationKey = req.get('x-integration-key') || 'unknown';
  const requestId = getRequestContextValue('requestId') || req.get('x-request-id') || 'unknown';

  // Interceptar response para capturar status code e dados
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Extrair dados da resposta para auditoria
    const externalEventId = body?.externalEventId || 'unknown';
    const eventType = body?.eventType || req.body?.type || 'unknown';
    const workspaceId = body?.workspaceId || req.body?.externalFacilityId || 'unknown';
    const message = body?.message || '';

    // Classificar resultado
    let resultType: ClinicAuditEvent['resultType'] = 'error';
    if (statusCode === 202) {
      resultType = 'success';
    } else if (statusCode === 200 && message.includes('already processed')) {
      resultType = 'duplicate';
    } else if (statusCode === 401) {
      resultType = 'invalid_auth';
    } else if (statusCode === 429) {
      resultType = 'rate_limited';
    } else if (statusCode === 400) {
      resultType = 'validation_failed';
    } else if (statusCode === 413) {
      resultType = 'payload_oversized';
    } else if (statusCode >= 500) {
      resultType = 'error';
    }

    recordClinicAuditEvent({
      timestamp: new Date().toISOString(),
      requestId,
      sourceIp,
      integrationKey,
      externalEventId,
      eventType,
      workspaceId,
      statusCode,
      resultType,
      durationMs,
      reason: statusCode >= 400 ? body?.error || body?.message : undefined,
    });

    return originalJson(body);
  };

  next();
}
