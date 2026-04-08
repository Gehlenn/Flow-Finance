import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authz } from '../middleware/authz';
import { validate } from '../middleware/validate';
import { SyncPullQuerySchema, SyncPushSchema } from '../validation/sync.schema';
import { getCloudSyncStoreStatus, pullSyncItems, pushSyncItems } from '../services/sync/cloudSyncStore';
import logger from '../config/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { recordAuditEvent } from '../services/admin/auditLog';

const router = Router();

type SyncEntity = 'accounts' | 'transactions' | 'goals' | 'reminders' | 'subscriptions';
type SyncPayloadItem = {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  payload?: Record<string, unknown>;
};

router.use(authMiddleware);
router.use(workspaceContextMiddleware);

function withScopedPayload(
  item: SyncPayloadItem,
  context: { userId: string; tenantId: string; workspaceId: string },
): SyncPayloadItem {
  if (!item.payload) {
    return item;
  }

  return {
    ...item,
    payload: {
      ...item.payload,
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
    },
  };
}

function recordEntityAuditEvents(
  entity: SyncEntity,
  items: SyncPayloadItem[],
  context: { userId: string; tenantId: string; workspaceId: string },
): void {
  const actionMap: Record<SyncEntity, { upsert: string; delete?: string; resourceType: string }> = {
    accounts: { upsert: 'account.created', delete: 'account.deleted', resourceType: 'account' },
    transactions: { upsert: 'transaction.created', delete: 'transaction.deleted', resourceType: 'transaction' },
    goals: { upsert: 'goal.created', delete: 'goal.deleted', resourceType: 'goal' },
    reminders: { upsert: 'reminder.created', delete: 'reminder.deleted', resourceType: 'reminder' },
    subscriptions: { upsert: 'billing.plan_changed', resourceType: 'subscription' },
  };

  const mapping = actionMap[entity];

  for (const item of items) {
    const action = item.deleted ? mapping.delete : mapping.upsert;
    if (!action) {
      continue;
    }

    recordAuditEvent({
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      action: action as Parameters<typeof recordAuditEvent>[0]['action'],
      status: 'success',
      resource: context.workspaceId,
      resourceType: mapping.resourceType,
      resourceId: item.id,
      metadata: {
        entity,
        deleted: Boolean(item.deleted),
        updatedAt: item.updatedAt,
        payloadKeys: item.payload ? Object.keys(item.payload) : [],
      },
    });
  }
}

router.get('/health', authz('sync:read'), asyncHandler(async (_req: Request, res: Response) => {
  const status = await getCloudSyncStoreStatus();
  res.json(status);
}));

router.post('/push', authz('sync:write'), validate(SyncPushSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const tenantId = req.tenantId as string;
  const workspaceId = req.workspaceId as string;
  const payload = req.body as { entity: SyncEntity; items: SyncPayloadItem[] };

  const scopedItems = payload.items.map((item) => withScopedPayload(item, { userId, tenantId, workspaceId }));
  const result = await pushSyncItems(workspaceId, payload.entity, scopedItems, { userId, workspaceId });
  recordEntityAuditEvents(payload.entity, scopedItems, { userId, tenantId, workspaceId });

  logger.info({ userId, tenantId, workspaceId, entity: payload.entity, upserted: result.upserted, deleted: result.deleted }, 'Cloud sync push completed');

  res.json({ success: true, ...result });
}));

router.get('/pull', authz('sync:read'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const tenantId = req.tenantId as string;
  const workspaceId = req.workspaceId as string;
  const parseResult = SyncPullQuerySchema.safeParse(req.query);
  const since = parseResult.success ? parseResult.data.since : undefined;

  const result = await pullSyncItems(workspaceId, since);
  logger.info({ userId, tenantId, workspaceId, since }, 'Cloud sync pull completed');
  res.json(result);
}));

export default router;
