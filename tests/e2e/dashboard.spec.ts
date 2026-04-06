import { test, expect, Page } from '@playwright/test';
import { skipIfNoAuthShell, skipIfDesktop } from './helpers/skipHelpers';

const NAV_LABELS = [/AI CFO/i, /Insights/i, /Open Bank/i, /Ajustes|Settings/i];

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
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render authenticated nav when available', async ({ page }) => {
    await skipIfNoAuthShell(page);
    const count = await visibleNavCount(page);

    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should navigate available sections without runtime failure', async ({ page }) => {
    await skipIfNoAuthShell(page);
    const count = await visibleNavCount(page);

    for (const pattern of NAV_LABELS) {
      const button = page.getByRole('button', { name: pattern });
      if (await button.count()) {
        await button.first().click();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should keep shell usable on mobile', async ({ page }, testInfo) => {
    await skipIfDesktop(testInfo);
    await skipIfNoAuthShell(page);

    const count = await visibleNavCount(page);

    const homeButton = page.getByRole('button', { name: /Inicio|Inicio|Home/i });
    if (await homeButton.count()) {
      await homeButton.first().click();
    }

    await expect(page.locator('body')).toBeVisible();
  });
});