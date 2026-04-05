import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';

import { validate } from '../../middleware/validate';
import { ClinicWebhookPayloadSchema } from '../../validation/clinicAutomation.schema';
import { ClinicAutomationService } from '../../services/clinic';
import { IntegrationMonitor } from '../../services/observability';
import { EnhancedFeatureFlagService } from '../../services/featureFlags/EnhancedFeatureFlagService';
import logger from '../../config/logger';
import redisClient from '../../config/redis';

/**
 * Rotas dedicadas para integração com automação da clínica.
 * Endpoints:
 * - POST /api/integrations/clinic/webhook - Ingerir eventos
 * - GET /api/integrations/clinic/health - Health check
 */

export function createClinicIntegrationRoutes(
  monitor: IntegrationMonitor,
  featureFlagService: EnhancedFeatureFlagService
): Router {
  const router = Router();
  const clinicService = new ClinicAutomationService(
    logger,
    redisClient,
    monitor,
    featureFlagService
  );

  /**
   * POST /api/integrations/clinic/webhook
   * Ingerir webhook vindo da automação da clínica.
   * Payload debe conter: auth { sourceSystem, requestId, hmacSignature } + data { ...evento }
   */
  router.post('/webhook', validate(ClinicWebhookPayloadSchema), async (req: Request, res: Response) => {
    const requestId = req.get('x-request-id') || uuidv4();
    const sourceIp = req.ip || 'unknown';
    const signature = req.get('x-webhook-signature') || '';

    try {
      Sentry.setTag('integration', 'clinic-automation');
      Sentry.setTag('source_ip', sourceIp);

      const payload = req.body;

      // Processar webhook
      const response = await clinicService.processWebhookEvent(
        payload,
        signature,
        sourceIp,
        {
          environment: (process.env.NODE_ENV || 'production') as any,
          sourceSystem: 'clinic-automation'
        }
      );

      // Retornar resposta
      const statusCode = response.success ? 200 : 400;
      res.status(statusCode).json({
        ...response,
        requestId
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error(
        {
          requestId,
          sourceIp,
          error: err.message,
          stack: err.stack
        },
        'Clinic webhook processing failed'
      );

      Sentry.captureException(err, {
        tags: {
          integration: 'clinic-automation',
          endpoint: 'webhook'
        },
        contexts: {
          request: {
            requestId,
            sourceIp
          }
        }
      });

      res.status(500).json({
        success: false,
        receivedEventId: uuidv4(),
        externalEventId: 'unknown',
        processedAt: new Date().toISOString(),
        idempotencyKey: '',
        message: `Error processing webhook: ${err.message}`
      });
    }
  });

  /**
   * GET /api/integrations/clinic/health
   * Health check do serviço de automação da clínica.
   */
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await clinicService.healthCheck();

      const statusCode = health.healthy ? 200 : 503;
      res.status(statusCode).json({
        service: 'clinic-automation',
        ...health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      res.status(503).json({
        service: 'clinic-automation',
        healthy: false,
        details: { unknown: false },
        message: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

export default createClinicIntegrationRoutes;
