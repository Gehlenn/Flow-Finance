import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { SyncPullQuerySchema, SyncPushSchema } from '../validation/sync.schema';
import { pullSyncItems, pushSyncItems } from '../services/sync/cloudSyncStore';
import logger from '../config/logger';

const router = Router();

router.use(authMiddleware);

router.post('/push', validate(SyncPushSchema), (req: Request, res: Response) => {
  const userId = req.userId as string;
  const payload = req.body as { entity: 'accounts' | 'transactions' | 'goals' | 'subscriptions'; items: Array<{ id: string; updatedAt: string; deleted?: boolean; payload?: Record<string, unknown> }> };

  const result = pushSyncItems(userId, payload.entity, payload.items);
  logger.info({ userId, entity: payload.entity, upserted: result.upserted, deleted: result.deleted }, 'Cloud sync push completed');

  res.json({ success: true, ...result });
});

router.get('/pull', (req: Request, res: Response) => {
  const userId = req.userId as string;
  const parseResult = SyncPullQuerySchema.safeParse(req.query);
  const since = parseResult.success ? parseResult.data.since : undefined;

  const result = pullSyncItems(userId, since);
  res.json(result);
});

export default router;