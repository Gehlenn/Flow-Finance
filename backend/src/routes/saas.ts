import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BillingHookSchema, UsageUpsertSchema } from '../validation/saas.schema';
import logger from '../config/logger';
import {
  appendBillingHook,
  getBillingHookCount,
  getUserUsage,
  setUserUsage,
} from '../utils/saasStore';

const router = Router();

router.use(authMiddleware);

router.get('/usage', (req: Request, res: Response) => {
  const userId = req.userId as string;
  res.json({ usage: getUserUsage(userId) });
});

router.put('/usage', validate(UsageUpsertSchema), (req: Request, res: Response) => {
  const userId = req.userId as string;
  const payload = req.body as { usage: Record<string, { transactions: number; aiQueries: number; bankConnections: number }> };

  setUserUsage(userId, payload.usage);
  res.json({ success: true });
});

router.post('/billing-hooks', validate(BillingHookSchema), (req: Request, res: Response) => {
  const userId = req.userId as string;
  const payload = req.body as {
    plan: 'free' | 'pro';
    event: 'usage_recorded' | 'limit_reached' | 'upgrade_required';
    resource: 'transactions' | 'aiQueries' | 'bankConnections';
    amount: number;
    at: string;
    metadata?: Record<string, unknown>;
  };

  appendBillingHook(userId, {
    ...payload,
    userId,
  });

  logger.info({ userId, billingEvents: getBillingHookCount(userId), event: payload.event }, 'SaaS billing hook received');

  res.json({ success: true });
});

export default router;
