import { Router } from 'express';
import { createSubscription, exportData } from '../billing/billingController';
import { authMiddleware } from '../middleware/auth';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { authz } from '../middleware/authz';

const router = Router();

router.use(authMiddleware);
router.use(workspaceContextMiddleware);

router.post('/subscription', authz('billing:manage'), createSubscription);
router.get('/export', authz('billing:read'), exportData);

export default router;
