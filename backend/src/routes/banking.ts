import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
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

router.get('/health', bankingHealthController);
router.post('/webhooks/pluggy', pluggyWebhookController);

router.use(authMiddleware);

router.get('/banks', listBanksController);
router.get('/connectors', listConnectorsController);
router.get('/connections', listConnectionsController);

router.post('/connect-token', validate(ConnectTokenSchema), createConnectTokenController);
router.post('/connect', validate(ConnectBankSchema), connectBankController);
router.post('/migrate/firebase', migrateCurrentUserConnectionsToFirebaseController);
router.post('/sync', validate(SyncBankSchema), syncBankController);
router.post('/disconnect', validate(DisconnectBankSchema), disconnectBankController);

export default router;
