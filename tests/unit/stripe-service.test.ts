import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { AppError } from '../../backend/src/middleware/errorHandler';
import {
  findWorkspaceForStripeCustomer,
  getPlanFromStripeEvent,
  parseStripeWebhookEvent,
  rememberStripeCustomerForWorkspace,
  resetStripeServiceForTests,
  verifyStripeWebhookSignature,
} from '../../backend/src/services/saas/stripeService';
import { createWorkspace, resetWorkspaceStoreForTests } from '../../backend/src/services/admin/workspaceStore';

function signPayload(payload: string, secret: string, timestamp: string): string {
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

describe('stripeService helpers', () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalProPrice = process.env.STRIPE_PRICE_PRO_MONTHLY;

  beforeEach(() => {
    resetStripeServiceForTests();
    resetWorkspaceStoreForTests();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_123';
  });

  it('validates Stripe v1 signature', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    const signature = signPayload(payload, process.env.STRIPE_WEBHOOK_SECRET as string, '1700000000');

    expect(verifyStripeWebhookSignature(payload, signature)).toBe(true);
    expect(verifyStripeWebhookSignature(payload, 't=1700000000,v1=invalid')).toBe(false);
  });

  it('parseStripeWebhookEvent throws AppError for invalid JSON', () => {
    expect(() => parseStripeWebhookEvent('{invalid')).toThrow(AppError);
  });

  it('persists Stripe customer lookup through workspace billing state', () => {
    const workspace = createWorkspace('Workspace Stripe', 'owner-1');

    rememberStripeCustomerForWorkspace(workspace.workspaceId, 'cus_stripe_123');

    expect(findWorkspaceForStripeCustomer('cus_stripe_123')?.workspaceId).toBe(workspace.workspaceId);
  });

  it('getPlanFromStripeEvent returns pro when price id matches', () => {
    const event = {
      id: 'evt_2',
      type: 'customer.subscription.updated',
      data: {
        object: {
          items: {
            data: [{ price: { id: 'price_pro_123' } }],
          },
        },
      },
    } as any;

    expect(getPlanFromStripeEvent(event)).toBe('pro');
  });

  it('getPlanFromStripeEvent returns free for subscription deleted', () => {
    const event = {
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      data: { object: {} },
    } as any;

    expect(getPlanFromStripeEvent(event)).toBe('free');
  });

  it('getPlanFromStripeEvent returns null when price is not recognized', () => {
    const event = {
      id: 'evt_4',
      type: 'customer.subscription.updated',
      data: {
        object: {
          items: {
            data: [{ price: { id: 'price_other' } }],
          },
        },
      },
    } as any;

    expect(getPlanFromStripeEvent(event)).toBeNull();
  });

  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }

    if (originalProPrice === undefined) {
      delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    } else {
      process.env.STRIPE_PRICE_PRO_MONTHLY = originalProPrice;
    }
  });
});
