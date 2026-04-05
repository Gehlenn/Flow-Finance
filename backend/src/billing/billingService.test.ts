import { beforeEach, describe, expect, it } from 'vitest';
import { BillingService } from './billingService';
import { createWorkspace, resetWorkspaceStoreForTests } from '../services/admin/workspaceStore';
import { getAuditEvents, resetAuditLogForTests } from '../services/admin/auditLog';

describe('BillingService', () => {
  beforeEach(() => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    resetWorkspaceStoreForTests();
    resetAuditLogForTests();
  });

  it('updates plan, subscription and audit trail for internal billing', async () => {
    const workspace = createWorkspace('Billing Workspace', 'owner-billing');
    const service = new BillingService();

    const updated = await service.createSubscription({
      workspaceId: workspace.workspaceId,
      plan: 'pro',
      actorUserId: 'owner-billing',
      billingEmail: 'billing@flow.test',
    });

    expect(updated.plan).toBe('pro');
    expect(updated.subscription?.status).toBe('active');
    expect(updated.entitlements?.features).toContain('billingManagement');

    const events = getAuditEvents({ action: 'billing.plan_changed', resource: workspace.workspaceId });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((event) => event.metadata?.currentPlan === 'pro')).toBe(true);
  });

  it('syncs stripe subscription state with durable workspace billing metadata', async () => {
    const workspace = createWorkspace('Stripe Workspace', 'owner-stripe');
    const service = new BillingService();

    const updated = await service.syncProviderSubscription({
      workspaceId: workspace.workspaceId,
      provider: 'stripe',
      plan: 'pro',
      actorUserId: 'owner-stripe',
      billingCustomerId: 'cus_stripe_123',
      providerSubscriptionId: 'sub_stripe_123',
      providerPriceId: 'price_pro_123',
      status: 'active',
    });

    expect(updated.plan).toBe('pro');
    expect(updated.billingCustomerId).toBe('cus_stripe_123');
    expect(updated.subscription?.provider).toBe('stripe');
    expect(updated.subscription?.providerCustomerId).toBe('cus_stripe_123');
    expect(updated.subscription?.providerSubscriptionId).toBe('sub_stripe_123');
    expect(updated.subscription?.providerPriceId).toBe('price_pro_123');
    expect(updated.entitlements?.features).toContain('billingManagement');

    const events = getAuditEvents({ action: 'billing.plan_changed', resource: workspace.workspaceId });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((event) => event.metadata?.currentPlan === 'pro')).toBe(true);
  });
});
