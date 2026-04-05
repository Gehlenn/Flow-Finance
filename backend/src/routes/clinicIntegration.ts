import { Router } from 'express';
import { externalIntegrationAuth } from '../middleware/externalIntegrationAuth';
import { createRateLimitByUser } from '../middleware/rateLimitByUser';
import { validate } from '../middleware/validate';
import { ClinicWebhookPayloadSchema } from '../validation/clinicAutomation.schema';
import { receiveClinicFinancialEvent } from '../controllers/clinicController';

const router = Router();

/**
 * Rate limit específico para ingestão da clínica.
 * Limite generoso para lotes de eventos mas com janela curta para detectar abuso.
 */
const clinicIngestLimiter = createRateLimitByUser({
  windowMs: 60 * 1000,        // 1 minuto
  max: 200,                    // 200 eventos/minuto por IP de origem
  keyGenerator: (req) => {
    const ip = (req.ip ?? 'unknown').replace('::ffff:', '');
    return `clinic::${ip}`;
  },
});

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
router.post(
  '/financial-events',
  externalIntegrationAuth,
  clinicIngestLimiter,
  validate(ClinicWebhookPayloadSchema),
  receiveClinicFinancialEvent,
);

export default router;
