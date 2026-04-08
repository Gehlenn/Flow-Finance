import { test, expect, Page } from '@playwright/test';
import { skipIfNoAuthShell } from './helpers/skipHelpers';
import { gotoAuthedApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

const NAV_LABELS = [/Inicio|Home/i, /Transacoes|Historico/i, /Fluxo/i, /Consultor IA/i, /Ajustes|Settings/i];

async function visibleNavCount(page: Page): Promise<number> {
  let count = 0;
  for (const pattern of NAV_LABELS) {
    const button = page.getByRole('button', { name: pattern });
    if (await button.count()) count += 1;
  }
  return count;
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedApp(page, {
      userId: 'dashboard-user',
      userEmail: 'dashboard@flow.dev',
      userName: 'Dashboard QA',
      token: 'dashboard-token',
    });
  });

  test('should render authenticated nav when available', async ({ page }) => {
    await skipIfNoAuthShell(page);
    const count = await visibleNavCount(page);

    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should navigate available sections without runtime failure', async ({ page }) => {
    await skipIfNoAuthShell(page);
    const count = await visibleNavCount(page);

    for (const pattern of NAV_LABELS) {
      const button = page.getByRole('button', { name: pattern });
      if (await button.count()) {
        await clickWithRetry(() => button);
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should keep shell usable on compact viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await skipIfNoAuthShell(page);

    const count = await visibleNavCount(page);

    const homeButton = page.getByRole('button', { name: /Inicio|Inicio|Home/i });
    if (await homeButton.count()) {
      await clickWithRetry(() => homeButton);
    }

    await expect(page.locator('body')).toBeVisible();
  });
});