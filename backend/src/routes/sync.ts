import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authz } from '../middleware/authz';
import { validate } from '../middleware/validate';
import { SyncPullQuerySchema, SyncPushSchema } from '../validation/sync.schema';
import { getCloudSyncStoreStatus, pullSyncItems, pushSyncItems } from '../services/sync/cloudSyncStore';
import logger from '../config/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';

const router = Router();

router.use(authMiddleware);
router.use(workspaceContextMiddleware);

router.get('/health', authz('sync:read'), asyncHandler(async (_req: Request, res: Response) => {
  const status = await getCloudSyncStoreStatus();
  res.json(status);
}));

router.post('/push', authz('sync:write'), validate(SyncPushSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId as string;
  const payload = req.body as { entity: 'accounts' | 'transactions' | 'goals' | 'subscriptions'; items: Array<{ id: string; updatedAt: string; deleted?: boolean; payload?: Record<string, unknown> }> };

  const result = await pushSyncItems(workspaceId, payload.entity, payload.items);
  logger.info({ userId, workspaceId, entity: payload.entity, upserted: result.upserted, deleted: result.deleted }, 'Cloud sync push completed');

  res.json({ success: true, ...result });
}));

router.get('/pull', authz('sync:read'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId as string;
  const parseResult = SyncPullQuerySchema.safeParse(req.query);
  const since = parseResult.success ? parseResult.data.since : undefined;

  const result = await pullSyncItems(workspaceId, since);
  logger.info({ userId, workspaceId, since }, 'Cloud sync pull completed');
  res.json(result);
}));

export default router;
