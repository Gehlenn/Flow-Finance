import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authz } from '../middleware/authz';
import { bankingLimiterByUser } from '../middleware/rateLimit';
import { quotaMiddleware } from '../middleware/quota';
import { validate } from '../middleware/validate';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { featureGateOpenFinance } from '../middleware/featureGate';
import {
  bankingHealthController,
  connectBankController,
  createConnectTokenController,
  disconnectBankController,
  listBanksController,
  listConnectionsController,
  listConnectorsController,
  migrateCurrentUserConnectionsToFirebaseController,
  pluggyWebhookController,
  syncBankController,
} from '../controllers/bankingController';
import { ConnectBankSchema, ConnectTokenSchema, DisconnectBankSchema, SyncBankSchema } from '../validation/banking.schema';

const router = Router();

// Health check and webhooks accessible even if feature is disabled (for ops/monitoring)
router.get('/health', bankingHealthController);
router.post('/webhooks/pluggy', pluggyWebhookController);

// Protected routes: auth → workspace → feature gate → rate limit
router.use(authMiddleware);
router.use(workspaceContextMiddleware);
router.use(featureGateOpenFinance()); // Gate all authenticated routes behind feature flag
router.use(bankingLimiterByUser);

router.get('/banks', authz('bankConnections:read'), listBanksController);
router.get('/connectors', authz('bankConnections:read'), listConnectorsController);
router.get('/connections', authz('bankConnections:read'), listConnectionsController);

router.post('/connect-token', authz('bankConnections:create'), validate(ConnectTokenSchema), createConnectTokenController);
router.post('/connect', authz('bankConnections:create'), quotaMiddleware('bankConnections'), validate(ConnectBankSchema), connectBankController);
router.post('/migrate/firebase', authz('bankConnections:update'), migrateCurrentUserConnectionsToFirebaseController);
router.post('/sync', authz('bankConnections:update'), validate(SyncBankSchema), syncBankController);
router.post('/disconnect', authz('bankConnections:delete'), validate(DisconnectBankSchema), disconnectBankController);

export default router;
