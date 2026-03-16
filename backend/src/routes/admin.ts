import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getAuditEvents, getAuditEventCount } from '../services/admin/auditLog';
import type { AuditAction, AuditStatus } from '../services/admin/auditLog';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/admin/audit
 * Returns recent audit events with optional filters.
 *
 * Query params:
 *   userId  — filter by user id
 *   action  — filter by AuditAction string
 *   status  — filter by AuditStatus (success|failure|blocked)
 *   limit   — max number of events to return (default 100, max 500)
 *   since   — ISO 8601 lower bound for `at`
 */
router.get('/audit', (req: Request, res: Response) => {
  const { userId, action, status, limit, since } = req.query;

  const parsedLimit = limit
    ? Math.min(Math.max(1, parseInt(String(limit), 10) || 100), 500)
    : 100;

  const events = getAuditEvents({
    userId: typeof userId === 'string' ? userId : undefined,
    action: typeof action === 'string' ? (action as AuditAction) : undefined,
    status: typeof status === 'string' ? (status as AuditStatus) : undefined,
    limit: parsedLimit,
    since: typeof since === 'string' ? since : undefined,
  });

  res.json({ events, total: getAuditEventCount() });
});

export default router;
