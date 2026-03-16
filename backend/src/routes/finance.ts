import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { financeMetricsController } from '../controllers/financeController';

const router = Router();

router.use(authMiddleware);

/**
 * POST /api/finance/metrics
 * Compute D3/D4 financial metrics from provided transactions.
 */
router.post('/metrics', financeMetricsController);

export default router;
