import { Router } from 'express';
import { listUsers, listAuditLogs, listUsageMetering, exportAuditLogs, exportUsageMetering } from '../admin/adminController';
import { authMiddleware } from '../middleware/auth';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { authz, requireFeature } from '../middleware/authz';

const router = Router();

router.use(authMiddleware);
router.use(workspaceContextMiddleware);
router.use(authz('admin:read'));
router.use(requireFeature('adminConsole'));

router.get('/users', listUsers);
router.get('/audit-logs', listAuditLogs);
router.get('/audit-logs/export', exportAuditLogs);
router.get('/usage-metering', listUsageMetering);
router.get('/usage-metering/export', exportUsageMetering);

export default router;
