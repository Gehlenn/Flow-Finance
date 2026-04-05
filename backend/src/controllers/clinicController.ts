import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { ClinicAutomationService } from '../services/clinic';
import { IntegrationTelemetry, IntegrationMonitor } from '../services/observability';
import { getFeatureFlagService } from '../config/featureFlags';
import { ClinicWebhookPayload } from '../validation/clinicAutomation.schema';
import logger from '../config/logger';
import redisClient from '../config/redis';
import type { RedisLike } from '../services/clinic/IdempotentEventStore';

// Lazy-init: serviços construídos na primeira chamada (sem Redis obrigatório no boot)
let _service: ClinicAutomationService | null = null;

function getClinicService(): ClinicAutomationService {
  if (!_service) {
    const telemetry = new IntegrationTelemetry(logger);
    const monitor = new IntegrationMonitor(telemetry, logger);
    const featureFlagService = getFeatureFlagService();

    // RedisClientType-compatible object built from environment (graceful fallback if Redis is absent)
    const redis = buildRedisClient();

    _service = new ClinicAutomationService(logger, redis, monitor, featureFlagService);
  }
  return _service;
}

function buildRedisClient(): RedisLike {
  const isProduction = process.env.NODE_ENV === 'production';

  if (process.env.REDIS_URL) {
    return redisClient as unknown as RedisLike;
  }

  if (isProduction) {
    throw new Error('REDIS_URL is required for clinic automation in production');
  }

  // Dev/test only fallback when Redis is intentionally absent.
  return createNoOpRedisClient();
}

function createNoOpRedisClient() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => { store.set(key, value); return 'OK'; },
    setEx: async (key: string, _ttl: number, value: string) => { store.set(key, value); return 'OK'; },
    exists: async (key: string) => (store.has(key) ? 1 : 0),
    del: async (key: string) => { store.delete(key); return 1; },
    keys: async (_pattern: string) => [] as string[],
    ttl: async (_key: string) => -1,
    ping: async () => 'PONG',
  } as any;
}

/**
 * POST /api/integrations/clinic/financial-events
 *
 * Ingestão de eventos financeiros vindos da automação da clínica.
 * - Autenticação via x-integration-key + HMAC opcional
 * - Validação de payload por schema Zod
 * - Idempotência por externalEventId
 * - Feature flags: clinic_automation_ingest_enabled / kill_switch_clinic_automation
 * - Telemetria Sentry + logs estruturados Pino
 */
export const receiveClinicFinancialEvent = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as ClinicWebhookPayload;
  const signature = req.header('x-integration-signature') ?? '';
  const sourceIp = (req.ip ?? req.socket?.remoteAddress ?? 'unknown').replace('::ffff:', '');

  const service = getClinicService();

  const result = await service.processWebhookEvent(
    payload,
    signature,
    sourceIp,
    { environment: (process.env.NODE_ENV || 'production') as any }
  );

  // 202 Accepted para novos eventos, 200 OK para duplicatas (idempotente)
  const isDuplicate = result.message?.includes('already processed');
  res.status(isDuplicate ? 200 : 202).json(result);
});
