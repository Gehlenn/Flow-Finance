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
    set: async (...args: any[]) => {
      const [key, value, optionsOrEx, _maybeTtl, maybeNx] = args;

      let useNx = false;
      if (optionsOrEx && typeof optionsOrEx === 'object') {
        useNx = Boolean(optionsOrEx.NX);
      } else if (
        typeof optionsOrEx === 'string'
        && optionsOrEx.toUpperCase() === 'EX'
        && typeof maybeNx === 'string'
        && maybeNx.toUpperCase() === 'NX'
      ) {
        useNx = true;
      }

      if (useNx && store.has(String(key))) {
        return null;
      }

      store.set(String(key), String(value));
      return 'OK';
    },
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

export const getClinicIntegrationHealth = asyncHandler(async (_req: Request, res: Response) => {
  const service = getClinicService();
  const featureFlagService = getFeatureFlagService();
  const environment = (process.env.NODE_ENV || 'production') as 'development' | 'staging' | 'production';

  const context = {
    environment,
    sourceSystem: 'clinic-automation' as const,
  };

  const ingest = featureFlagService.isEnabled('clinic_automation_ingest_enabled', context);
  const autoPost = featureFlagService.isEnabled('clinic_automation_auto_post_enabled', context);

  const health = await service.healthCheck();

  const payloadLimitBytes = Number.parseInt(process.env.CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES || '', 10);
  const edgeRateLimitMax = Number.parseInt(process.env.CLINIC_EDGE_RATE_LIMIT_MAX || '', 10);
  const authRateLimitMax = Number.parseInt(process.env.CLINIC_AUTH_RATE_LIMIT_MAX || '', 10);

  res.status(health.healthy ? 200 : 503).json({
    healthy: health.healthy,
    checkedAt: new Date().toISOString(),
    environment,
    dependencies: health.details,
    features: {
      clinicAutomationIngest: ingest,
      clinicAutomationAutoPost: autoPost,
    },
    safeguards: {
      payloadMaxBytes: Number.isFinite(payloadLimitBytes) && payloadLimitBytes > 0 ? payloadLimitBytes : 256 * 1024,
      edgeRateLimitMax: Number.isFinite(edgeRateLimitMax) && edgeRateLimitMax > 0 ? edgeRateLimitMax : 300,
      authRateLimitMax: Number.isFinite(authRateLimitMax) && authRateLimitMax > 0 ? authRateLimitMax : 200,
      timestampSkewSeconds: Number.parseInt(process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS || '300', 10),
    },
  });
});
