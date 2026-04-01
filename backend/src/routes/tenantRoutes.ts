import { Router } from 'express';
import { createTenant, selectTenant } from '../tenant/tenantController';

const router = Router();

router.post('/', createTenant);
router.post('/select', selectTenant);

export default router;
