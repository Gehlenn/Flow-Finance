import { test, expect } from '@playwright/test';

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

  test('should render billing overview and support upgrade fallback', async ({ page, isMobile }) => {
    if (isMobile) {
      test.skip(true, 'Billing E2E desktop-only.');
    }

    await page.goto('/?e2eAuth=1&userId=billing-user&userEmail=billing%40flow.dev&userName=Billing%20QA&token=billing-token');
    await page.getByRole('button', { name: /Ajustes/i }).click();

    await expect(page.getByText(/Plano atual: Free/i)).toBeVisible();
    await expect(page.locator('body')).toContainText('12 transações');

    await page.getByRole('button', { name: /Fazer Upgrade/i }).click();

    await expect(page.getByText(/Plano atual: Pro/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Plano Pro Ativo/i })).toBeVisible();
  });

  test('should open Stripe portal redirect when available', async ({ page, isMobile }) => {
    if (isMobile) {
      test.skip(true, 'Billing E2E desktop-only.');
    }

    await page.goto('/?e2eAuth=1&userId=billing-user&userEmail=billing%40flow.dev&userName=Billing%20QA&token=billing-token');
    await page.getByRole('button', { name: /Ajustes/i }).click();
    await page.getByRole('button', { name: /Gerenciar Plano/i }).click();

    await page.waitForURL(/billing-portal/);
  });
});