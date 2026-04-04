import { Router } from 'express';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { authz, requireFeature } from '../middleware/authz';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { financeEventsLimiterByUser } from '../middleware/rateLimit';
import { financeMetricsController } from '../controllers/financeController';
import { asyncHandler } from '../middleware/errorHandler';
import { appendDomainEvent, getDomainEvents } from '../services/finance/eventStore';
import { acknowledgeEvent, enqueueEvent, getPendingEvents, retryEvent } from '../events/eventQueue';

const router = Router();

router.use(authMiddleware);
router.use(workspaceContextMiddleware);

type QueuedDomainEventInput = Parameters<typeof appendDomainEvent>[0];

async function flushQueuedDomainEvents(): Promise<void> {
  const pending = await getPendingEvents();

  for (const item of pending) {
    const payload = item.payload as QueuedDomainEventInput;

    try {
      await appendDomainEvent(payload);
      await acknowledgeEvent(item.id);
    } catch {
      await retryEvent(item.id);
    }
  }
}

/**
 * POST /api/finance/metrics
 * Compute D3/D4 financial metrics from provided transactions.
 */
router.post('/metrics', authz('finance:read'), requireFeature('advancedInsights'), financeMetricsController);

router.post('/events', authz('finance:read'), financeEventsLimiterByUser, asyncHandler(async (req: Request, res: Response) => {
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

  await flushQueuedDomainEvents();

  const eventInput: QueuedDomainEventInput = {
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
  };

  const queueItem = await enqueueEvent(randomUUID(), eventInput);

  try {
    const event = await appendDomainEvent(eventInput);
    await acknowledgeEvent(queueItem.id);
    res.status(201).json({ event });
    return;
  } catch {
    await retryEvent(queueItem.id);
    res.status(202).json({ queued: true, retryScheduled: true });
    return;
  }
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
