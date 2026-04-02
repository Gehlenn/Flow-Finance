import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authz, requireFeature } from '../middleware/authz';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { financeMetricsController } from '../controllers/financeController';
import { asyncHandler } from '../middleware/errorHandler';
import { appendDomainEvent, getDomainEvents } from '../services/finance/eventStore';

const router = Router();

router.use(authMiddleware);
router.use(workspaceContextMiddleware);

/**
 * POST /api/finance/metrics
 * Compute D3/D4 financial metrics from provided transactions.
 */
router.post('/metrics', authz('finance:read'), requireFeature('advancedInsights'), financeMetricsController);

router.post('/events', authz('finance:read'), asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as {
    id?: string;
    type: string;
    aggregateId?: string;
    aggregateType?: string;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    occurredAt?: string;
  };

  if (!payload.type || typeof payload.type !== 'string') {
    res.status(400).json({ error: 'type obrigatorio' });
    return;
  }

  const event = await appendDomainEvent({
    id: payload.id,
    workspaceId: req.workspaceId!,
    tenantId: req.tenantId,
    userId: req.userId,
    aggregateId: payload.aggregateId,
    aggregateType: payload.aggregateType,
    type: payload.type,
    payload: payload.payload,
    metadata: payload.metadata,
    occurredAt: payload.occurredAt || new Date().toISOString(),
  });

  res.status(201).json({ event });
}));

router.get('/events', authz('finance:read'), asyncHandler(async (req: Request, res: Response) => {
  const events = await getDomainEvents({
    workspaceId: req.workspaceId!,
    aggregateId: typeof req.query.aggregateId === 'string' ? req.query.aggregateId : undefined,
    aggregateType: typeof req.query.aggregateType === 'string' ? req.query.aggregateType : undefined,
    type: typeof req.query.type === 'string' ? req.query.type : undefined,
    userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
    since: typeof req.query.since === 'string' ? req.query.since : undefined,
    until: typeof req.query.until === 'string' ? req.query.until : undefined,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
  });

  res.json({ events });
}));

export default router;
