import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authz, requireFeature } from '../middleware/authz';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { financeMetricsController } from '../controllers/financeController';

const router = Router();

router.use(authMiddleware);
router.use(workspaceContextMiddleware);

/**
 * POST /api/finance/metrics
 * Compute D3/D4 financial metrics from provided transactions.
 */
router.post('/metrics', authz('finance:read'), requireFeature('advancedInsights'), financeMetricsController);

export default router;
