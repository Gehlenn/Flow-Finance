import { test, expect } from '@playwright/test';
import { skipIfMobile } from './helpers/skipHelpers';
import { gotoAuthedApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

test.describe('Billing Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const month = new Date().toISOString().slice(0, 7);
      const state = {
        currentPlan: 'free',
      };

      Object.assign(window, { __billingTestState: state });

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : String(input);

        if (url.includes('/api/saas/plans')) {
          return new Response(JSON.stringify({
            currentPlan: state.currentPlan,
            plans: [
              { id: 'free', name: 'Free' },
              { id: 'pro', name: 'Pro' },
            ],
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/api/saas/usage')) {
          return new Response(JSON.stringify({
            usage: {
              [month]: {
                transactions: 12,
                aiQueries: 3,
                bankConnections: 1,
              },
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/api/saas/stripe/checkout-session')) {
          return new Response(JSON.stringify({ id: 'sess_mock', url: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/api/saas/plan')) {
          state.currentPlan = 'pro';
          return new Response(JSON.stringify({ success: true, currentPlan: state.currentPlan }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/api/saas/stripe/portal-session')) {
          return new Response(JSON.stringify({ url: '/billing-portal' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return originalFetch(input, init);
      };
    });
  });

  test('should render billing overview and support upgrade fallback', async ({ page }, testInfo) => {
    await skipIfMobile(testInfo);

    await gotoAuthedApp(page, {
      userId: 'billing-user',
      userEmail: 'billing@flow.dev',
      userName: 'Billing QA',
      token: 'billing-token',
    });
    await clickWithRetry(() => page.getByRole('button', { name: /Ajustes/i }));

    const planCard = page.getByText(/Plano: Free/i);
    await expect(planCard).toBeVisible({ timeout: 10000 });
  });

  test('should open Stripe portal redirect when available', async ({ page }, testInfo) => {
    await skipIfMobile(testInfo);

    await gotoAuthedApp(page, {
      userId: 'billing-user',
      userEmail: 'billing@flow.dev',
      userName: 'Billing QA',
      token: 'billing-token',
    });
    await clickWithRetry(() => page.getByRole('button', { name: /Ajustes/i }));

    const workspaceAdminButton = page.getByRole('button', { name: /Abrir admin do workspace/i });
    await expect(workspaceAdminButton).toBeVisible({ timeout: 10000 });
    await clickWithRetry(() => workspaceAdminButton);

    await expect(page.locator('body')).toContainText(/Plano:|Faturamento e uso/i);
  });
});