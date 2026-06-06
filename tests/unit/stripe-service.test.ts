import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { AppError } from '../../backend/src/middleware/errorHandler';
import {
  createStripeCheckoutSession,
  claimStripeWebhookEvent,
  findWorkspaceForStripeCustomer,
  getPlanFromStripeEvent,
  parseStripeWebhookEvent,
  rememberStripeCustomerForWorkspace,
  resetStripeServiceForTests,
  verifyStripeWebhookSignature,
  verifyStripeWebhookSignatureAt,
} from '../../backend/src/services/saas/stripeService';
import { createWorkspace, getWorkspaceAsync, resetWorkspaceStoreForTests } from '../../backend/src/services/admin/workspaceStore';

type StripeSubscriptionEvent = {
  id: string;
  type: string;
  data: {
    object: {
      items?: {
        data?: Array<{ price?: { id?: string } }>;
      };
    };
  };
};

function signPayload(payload: string, secret: string, timestamp: string): string {
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

describe('stripeService helpers', () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalProPrice = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetStripeServiceForTests();
    resetWorkspaceStoreForTests();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_123';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  it('validates Stripe v1 signature', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    const timestamp = String(Math.floor(nowMs / 1000));
    const signature = signPayload(payload, process.env.STRIPE_WEBHOOK_SECRET as string, timestamp);

    expect(verifyStripeWebhookSignatureAt(payload, signature, nowMs)).toBe(true);
    expect(verifyStripeWebhookSignatureAt(payload, `t=${timestamp},v1=invalid`, nowMs)).toBe(false);
  });

  it('rejects stale Stripe webhook signatures', () => {
    const payload = JSON.stringify({ id: 'evt_stale', type: 'checkout.session.completed', data: { object: {} } });
    const nowMs = Date.UTC(2026, 0, 1, 0, 10, 1);
    const staleTimestamp = String(Math.floor(Date.UTC(2026, 0, 1, 0, 0, 0) / 1000));
    const signature = signPayload(payload, process.env.STRIPE_WEBHOOK_SECRET as string, staleTimestamp);

    expect(verifyStripeWebhookSignatureAt(payload, signature, nowMs)).toBe(false);
  });

  it('deduplicates Stripe webhook event ids', async () => {
    await expect(claimStripeWebhookEvent('evt_repeat')).resolves.toBe(true);
    await expect(claimStripeWebhookEvent('evt_repeat')).resolves.toBe(false);

    resetStripeServiceForTests();

    await expect(claimStripeWebhookEvent('evt_repeat')).resolves.toBe(true);
  });

  it('parseStripeWebhookEvent throws AppError for invalid JSON', () => {
    expect(() => parseStripeWebhookEvent('{invalid')).toThrow(AppError);
  });

  it('persists Stripe customer lookup through workspace billing state', async () => {
    const workspace = createWorkspace('Workspace Stripe', 'owner-1');

    await rememberStripeCustomerForWorkspace(workspace.workspaceId, 'cus_stripe_123');

    expect((await findWorkspaceForStripeCustomer('cus_stripe_123'))?.workspaceId).toBe(workspace.workspaceId);
  });

  it('propagates workspace metadata to Stripe subscription data and persists the returned customer', async () => {
    const workspace = createWorkspace('Workspace Checkout', 'owner-checkout');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.test/session',
        customer: 'cus_checkout_123',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const session = await createStripeCheckoutSession({
      userId: 'owner-checkout',
      email: 'owner@example.com',
      returnUrl: 'https://flow-finance.test/billing-return',
      workspaceId: workspace.workspaceId,
    });

    expect(session).toEqual({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/session',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/checkout/sessions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(`subscription_data%5Bmetadata%5D%5BworkspaceId%5D=${workspace.workspaceId}`),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('subscription_data%5Bmetadata%5D%5BuserId%5D=owner-checkout');

    await expect(getWorkspaceAsync(workspace.workspaceId)).resolves.toMatchObject({
      billingCustomerId: 'cus_checkout_123',
    });
  });

  it('getPlanFromStripeEvent returns pro when price id matches', () => {
    const event: StripeSubscriptionEvent = {
      id: 'evt_2',
      type: 'customer.subscription.updated',
      data: {
        object: {
          items: {
            data: [{ price: { id: 'price_pro_123' } }],
          },
        },
      },
    };

    expect(getPlanFromStripeEvent(event)).toBe('pro');
  });

  it('getPlanFromStripeEvent returns free for subscription deleted', () => {
    const event: StripeSubscriptionEvent = {
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      data: { object: {} },
    };

    expect(getPlanFromStripeEvent(event)).toBe('free');
  });

  it('getPlanFromStripeEvent returns null when price is not recognized', () => {
    const event: StripeSubscriptionEvent = {
      id: 'evt_4',
      type: 'customer.subscription.updated',
      data: {
        object: {
          items: {
            data: [{ price: { id: 'price_other' } }],
          },
        },
      },
    };

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

    if (originalStripeSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalStripeSecret;
    }

    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });
});
