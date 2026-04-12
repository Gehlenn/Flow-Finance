import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createTenant, selectTenant } from '../tenant/tenantController';

const router = Router();

router.use(authMiddleware);

router.post('/', createTenant);
router.post('/select', selectTenant);

export default router;

