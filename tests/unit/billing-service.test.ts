import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../backend/src/middleware/errorHandler';
import { getAuditEvents, resetAuditLogForTests } from '../../backend/src/services/admin/auditLog';
import {
  applyBillingHook,
  changeUserPlan,
  getPlanCatalog,
  isMockBillingEnabled,
} from '../../backend/src/services/saas/billingService';
import {
  getBillingHookCount,
  getBillingHooksForUser,
  getUserPlan,
  incrementMonthlyUsage,
  PLAN_LIMITS,
  resetSaasStoreForTests,
} from '../../backend/src/utils/saasStore';

describe('billingService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMockBilling = process.env.ALLOW_MOCK_BILLING_UPDATES;
  const originalProPrice = process.env.SAAS_PRO_MONTHLY_PRICE_CENTS;
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY;
  const originalStripePrice = process.env.STRIPE_PRICE_PRO_MONTHLY;

  beforeEach(() => {
    resetSaasStoreForTests();
    resetAuditLogForTests();
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_MOCK_BILLING_UPDATES;
    delete process.env.SAAS_PRO_MONTHLY_PRICE_CENTS;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalMockBilling === undefined) {
      delete process.env.ALLOW_MOCK_BILLING_UPDATES;
    } else {
      process.env.ALLOW_MOCK_BILLING_UPDATES = originalMockBilling;
    }

    if (originalProPrice === undefined) {
      delete process.env.SAAS_PRO_MONTHLY_PRICE_CENTS;
    } else {
      process.env.SAAS_PRO_MONTHLY_PRICE_CENTS = originalProPrice;
    }

    if (originalStripeSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalStripeSecret;
    }

    if (originalStripePrice === undefined) {
      delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    } else {
      process.env.STRIPE_PRICE_PRO_MONTHLY = originalStripePrice;
    }
  });

  it('retorna catalogo com plano atual e limites por plano', () => {
    incrementMonthlyUsage('user-free', 'aiQueries', 3);

    const catalog = getPlanCatalog('user-free');

    expect(catalog.currentPlan).toBe('free');
    expect(catalog.mockBillingEnabled).toBe(true);
    expect(catalog.billingProvider).toBe('mock');
    expect(catalog.manualPlanChangeAllowed).toBe(true);
    expect(catalog.stripeConfigured).toBe(false);
    expect(catalog.stripePortalEnabled).toBe(false);
    expect(catalog.hasBillingCustomer).toBe(false);
    expect(catalog.plans).toHaveLength(2);
    expect(catalog.plans.find((plan) => plan.id === 'free')?.limits).toEqual(PLAN_LIMITS.free);
    expect(catalog.plans.find((plan) => plan.id === 'pro')?.limits).toEqual(PLAN_LIMITS.pro);
  });

  it('expõe stripe como provider quando a configuração real está disponível', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_flow';
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_flow_pro';

    const catalog = getPlanCatalog('user-stripe');

    expect(catalog.stripeConfigured).toBe(true);
    expect(catalog.billingProvider).toBe('stripe');
    expect(catalog.manualPlanChangeAllowed).toBe(true);
    expect(catalog.stripePortalEnabled).toBe(false);
  });

  it('usa preco configurado via env para o plano pro', () => {
    process.env.SAAS_PRO_MONTHLY_PRICE_CENTS = '4990';

    const catalog = getPlanCatalog('user-price');
    expect(catalog.plans.find((plan) => plan.id === 'pro')?.priceMonthlyCents).toBe(4990);
  });

  it('permite trocar plano via API mock quando habilitado', () => {
    const result = changeUserPlan({
      userId: 'user-upgrade',
      targetPlan: 'pro',
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(result.changed).toBe(true);
    expect(result.previousPlan).toBe('free');
    expect(result.currentPlan).toBe('pro');
    expect(getUserPlan('user-upgrade')).toBe('pro');
    expect(getBillingHookCount('user-upgrade')).toBe(1);
    expect(getBillingHooksForUser('user-upgrade')[0]).toEqual(
      expect.objectContaining({ event: 'plan_changed', plan: 'pro', amount: 0 }),
    );
    expect(getAuditEvents({ action: 'billing.plan_changed' })).toHaveLength(1);
  });

  it('nao gera hook nem audit quando a troca de plano e no-op', () => {
    const result = changeUserPlan({ userId: 'user-noop', targetPlan: 'free' });

    expect(result.changed).toBe(false);
    expect(getBillingHookCount('user-noop')).toBe(0);
    expect(getAuditEvents({ action: 'billing.plan_changed' })).toHaveLength(0);
  });

  it('bloqueia troca mock quando a flag esta desabilitada fora de teste', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_BILLING_UPDATES;

    expect(() => changeUserPlan({ userId: 'user-prod', targetPlan: 'pro' })).toThrow(AppError);
    expect(() => changeUserPlan({ userId: 'user-prod', targetPlan: 'pro' })).toThrow(
      'Mock billing updates are disabled in this environment',
    );
  });

  it('sincroniza plano via billing hook plan_changed', () => {
    const result = applyBillingHook({
      userId: 'user-hook',
      plan: 'pro',
      event: 'plan_changed',
      amount: 0,
      at: '2026-03-16T10:00:00.000Z',
      metadata: { provider: 'mock' },
      ip: '10.0.0.1',
      userAgent: 'billing-worker',
    });

    expect(result.changed).toBe(true);
    expect(result.previousPlan).toBe('free');
    expect(result.currentPlan).toBe('pro');
    expect(getUserPlan('user-hook')).toBe('pro');
    expect(getBillingHookCount('user-hook')).toBe(1);
    expect(getAuditEvents({ action: 'billing.plan_changed' })).toHaveLength(1);
  });

  it('nao altera plano em eventos de billing sem troca de plano', () => {
    const result = applyBillingHook({
      userId: 'user-usage',
      plan: 'free',
      event: 'limit_reached',
      resource: 'aiQueries',
      amount: 1,
      at: '2026-03-16T10:00:00.000Z',
      metadata: { reason: 'quota' },
    });

    expect(result.changed).toBe(false);
    expect(result.currentPlan).toBe('free');
    expect(getUserPlan('user-usage')).toBe('free');
    expect(getBillingHookCount('user-usage')).toBe(1);
    expect(getAuditEvents({ action: 'billing.plan_changed' })).toHaveLength(0);
  });

  it('isMockBillingEnabled reflete NODE_ENV test e flag explicita', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_BILLING_UPDATES;
    expect(isMockBillingEnabled()).toBe(false);

    process.env.ALLOW_MOCK_BILLING_UPDATES = 'true';
    expect(isMockBillingEnabled()).toBe(true);
  });
});
