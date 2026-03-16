import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  BillingHookSchema,
  PlanChangeSchema,
  StripeCheckoutSchema,
  StripePortalSchema,
  UsageUpsertSchema,
} from '../validation/saas.schema';
import logger from '../config/logger';
import {
  getBillingHookCount,
  getUserUsage,
  setUserUsage,
} from '../utils/saasStore';
import { applyBillingHook, changeUserPlan, getPlanCatalog } from '../services/saas/billingService';
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  getPlanFromStripeEvent,
  parseStripeWebhookEvent,
  rememberStripeCustomer,
  verifyStripeWebhookSignature,
} from '../services/saas/stripeService';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/stripe/webhook', (req: Request, res: Response) => {
  const rawBody = req.rawBody || '';
  const signatureHeader = req.header('stripe-signature');

  if (!verifyStripeWebhookSignature(rawBody, signatureHeader)) {
    throw new AppError(401, 'Invalid Stripe webhook signature');
  }

  const event = parseStripeWebhookEvent(rawBody);
  const customerId = event.data.object.customer;
  const userId = event.data.object.metadata?.userId;

  if (userId && customerId) {
    rememberStripeCustomer(userId, customerId);
  }

  const nextPlan = getPlanFromStripeEvent(event);
  if (userId && nextPlan) {
    applyBillingHook({
      userId,
      plan: nextPlan,
      event: 'plan_changed',
      amount: 0,
      at: new Date().toISOString(),
      metadata: {
        stripeEventType: event.type,
        stripeEventId: event.id,
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  logger.info({ eventType: event.type, eventId: event.id, userId, appliedPlan: nextPlan }, 'Stripe webhook processed');
  res.json({ received: true });
});

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

router.get('/plans', (req: Request, res: Response) => {
  const userId = req.userId as string;
  res.json(getPlanCatalog(userId));
});

router.post('/stripe/checkout-session', validate(StripeCheckoutSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const returnUrl = String(req.body.returnUrl);

  const session = await createStripeCheckoutSession({
    userId,
    email: req.userEmail,
    returnUrl,
  });

  res.json(session);
}));

router.post('/stripe/portal-session', validate(StripePortalSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const returnUrl = String(req.body.returnUrl);
  const session = await createStripePortalSession({ userId, returnUrl });
  res.json(session);
}));

router.post('/plan', validate(PlanChangeSchema), (req: Request, res: Response) => {
  const userId = req.userId as string;
  const payload = req.body as { plan: 'free' | 'pro' };

  const result = changeUserPlan({
    userId,
    targetPlan: payload.plan,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.info({ userId, previousPlan: result.previousPlan, currentPlan: result.currentPlan }, 'SaaS plan changed');

  res.json(result);
});

router.post('/billing-hooks', validate(BillingHookSchema), (req: Request, res: Response) => {
  const userId = req.userId as string;
  const payload = req.body as {
    plan: 'free' | 'pro';
    event: 'usage_recorded' | 'limit_reached' | 'upgrade_required' | 'plan_changed';
    resource?: 'transactions' | 'aiQueries' | 'bankConnections';
    amount: number;
    at: string;
    metadata?: Record<string, unknown>;
  };

  const result = applyBillingHook({
    userId,
    plan: payload.plan,
    event: payload.event,
    resource: payload.resource,
    amount: payload.amount,
    at: payload.at,
    metadata: payload.metadata,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.info(
    { userId, billingEvents: getBillingHookCount(userId), event: payload.event, currentPlan: result.currentPlan },
    'SaaS billing hook received',
  );

  res.json({ success: true, currentPlan: result.currentPlan, changed: result.changed });
});

export default router;
