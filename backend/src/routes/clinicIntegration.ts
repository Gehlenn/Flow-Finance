import { NextFunction, Request, Response, Router } from 'express';
import { externalIntegrationAuth } from '../middleware/externalIntegrationAuth';
import redisClient from '../config/redis';
import { createDistributedRateLimitByUser } from '../middleware/distributedRateLimitByUser';
import { createClinicPayloadLimitMiddleware } from '../middleware/clinicPayloadLimit';
import { validate } from '../middleware/validate';
import { ClinicWebhookIngestSchema } from '../validation/clinicAutomation.schema';
import { getClinicIntegrationHealth, receiveClinicFinancialEvent, getClinicAuditMetrics } from '../controllers/clinicController';
import { clinicAuditMiddleware } from '../middleware/clinicAudit';

const router = Router();

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

const clinicEdgeLimitMax = parsePositiveInt(process.env.CLINIC_EDGE_RATE_LIMIT_MAX, 300);
const clinicAuthLimitMax = parsePositiveInt(process.env.CLINIC_AUTH_RATE_LIMIT_MAX, 200);

const clinicPayloadLimit = createClinicPayloadLimitMiddleware();

/**
 * Rate limit de borda por IP para conter burst antes de qualquer custo de auth.
 */
const clinicEdgeLimiter = createDistributedRateLimitByUser({
  redis: redisClient,
  namespace: 'clinic-edge',
  windowMs: 60 * 1000,
  max: clinicEdgeLimitMax,
  keyGenerator: (req) => {
    const ip = (req.ip ?? 'unknown').replace('::ffff:', '');
    return `clinic-edge::${ip}`;
  },
});

/**
 * Rate limit específico para ingestão da clínica.
 * Limite generoso para lotes de eventos mas com janela curta para detectar abuso.
 */
const clinicIngestAuthenticatedLimiter = createDistributedRateLimitByUser({
  redis: redisClient,
  namespace: 'clinic-auth',
  windowMs: 60 * 1000,        // 1 minuto
  max: clinicAuthLimitMax,
  keyGenerator: (req) => {
    const integrationKey = req.header('x-integration-key') || 'unknown-key';
    const ip = (req.ip ?? 'unknown').replace('::ffff:', '');
    const workspaceId = req.body?.externalFacilityId || req.body?.workspaceId || 'unknown';
    return `clinic-auth::${integrationKey}::${workspaceId}::${ip}`;
  },
});

const clinicWebhookMiddlewares = [
  clinicAuditMiddleware,
  clinicEdgeLimiter,
  clinicPayloadLimit,
  externalIntegrationAuth,
  clinicIngestAuthenticatedLimiter,
  validate(ClinicWebhookIngestSchema),
] as const;

function markLegacyClinicPath(_req: Request, res: Response, next: NextFunction) {
  // Mantém compatibilidade com clientes antigos enquanto sinaliza migração.
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 30 Sep 2026 23:59:59 GMT');
  res.setHeader('Link', '</api/integrations/clinic/webhook>; rel="successor-version"');
  next();
}

/**
 * POST /api/integrations/clinic/financial-events
 *
 * Endpoint dedicado para ingestão de eventos financeiros da automação da clínica.
 *
 * Headers obrigatórios:
 *   x-integration-key: <API key da clínica configurada em FLOW_EXTERNAL_INTEGRATION_KEYS>
 *   x-integration-signature: sha256=<HMAC-SHA256(timestamp.body)> (opcional em dev)
 *   x-integration-timestamp: <unix timestamp da geração do evento>
 *   Content-Type: application/json
 *
 * Body: ClinicWebhookPayload (discriminated union por `type`)
 *   - payment_received
 *   - expense_recorded
 *   - receivable_reminder_created
 *   - receivable_reminder_updated
 *   - receivable_reminder_cleared
 *
 * Respostas:
 *   202 Accepted  — evento aceito para processamento
 *   200 OK        — evento já processado (idempotência)
 *   400 Bad Request — payload inválido ou feature flag desabilitada
 *   401 Unauthorized — chave de integração inválida
 *   429 Too Many Requests — rate limit atingido
 */
router.post('/webhook', ...clinicWebhookMiddlewares, receiveClinicFinancialEvent);

router.post(
  '/financial-events',
  markLegacyClinicPath,
  ...clinicWebhookMiddlewares,
  receiveClinicFinancialEvent,
);

router.get(
  '/health',
  clinicEdgeLimiter,
  externalIntegrationAuth,
  getClinicIntegrationHealth,
);

router.get(
  '/metrics',
  clinicEdgeLimiter,
  externalIntegrationAuth,
  getClinicAuditMetrics,
);

export default router;
