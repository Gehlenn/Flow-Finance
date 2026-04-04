import { Router } from 'express';
import { validate } from '../middleware/validate';
import { ExternalIntegrationEventSchema } from '../validation/externalIntegration.schema';
import { receiveExternalIntegrationEventController } from '../controllers/externalIntegrationController';
import { externalIntegrationAuth } from '../middleware/externalIntegrationAuth';
import { createRateLimitByUser } from '../middleware/rateLimitByUser';

const router = Router();

const externalIntegrationLimiter = createRateLimitByUser({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => {
    const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : 'unknown-workspace';
    const sourceSystem = typeof req.body?.sourceSystem === 'string' ? req.body.sourceSystem : 'unknown-source';
    return `external::${workspaceId}::${sourceSystem}`;
  },
});

router.post(
  '/events',
  externalIntegrationAuth,
  externalIntegrationLimiter,
  validate(ExternalIntegrationEventSchema),
  receiveExternalIntegrationEventController,
);

export default router;
