import { Router } from 'express';
import { featureGate } from '../middleware/featureGate';
import { Feature } from '../services/featureFlags/types';
import { integrationBindingScope } from '../middleware/integrationBindingScope';
import { createRateLimitByUser } from '../middleware/rateLimitByUser';
import {
  businessIntegrationAuth,
  validateBusinessIntegration,
} from '../middleware/businessIntegrationContract';
import {
  ingestIntegrationReminderController,
  ingestIntegrationTransactionController,
} from '../controllers/businessIntegrationController';
import {
  IntegrationReminderSchema,
  IntegrationTransactionSchema,
} from '../validation/businessIntegration.schema';

const router = Router();

const integrationLimiter = createRateLimitByUser({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => {
    const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : 'unknown-workspace';
    const sourceSystem = typeof req.body?.sourceSystem === 'string' ? req.body.sourceSystem : 'unknown-source';
    return `business-integration::${workspaceId}::${sourceSystem}`;
  },
});

router.use(featureGate(Feature.EXTERNAL_INTEGRATIONS));

router.post(
  '/transactions',
  businessIntegrationAuth,
  integrationLimiter,
  validateBusinessIntegration(IntegrationTransactionSchema),
  integrationBindingScope,
  ingestIntegrationTransactionController,
);

router.post(
  '/reminders',
  businessIntegrationAuth,
  integrationLimiter,
  validateBusinessIntegration(IntegrationReminderSchema),
  integrationBindingScope,
  ingestIntegrationReminderController,
);

export default router;
