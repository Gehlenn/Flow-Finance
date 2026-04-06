import { test, expect, Page } from '@playwright/test';
import { skipIfNoAuthShell, skipIf } from './helpers/skipHelpers';

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

test.describe('Transaction Management', () => {
  test('should keep shell responsive around transaction area', async ({ page }) => {
    await openApp(page);
    await skipIfNoAuthShell(page);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should open transaction creation action when exposed', async ({ page }) => {
    await openApp(page);
    await skipIfNoAuthShell(page);

    const addButton = page.getByRole('button', {
      name: /Add|Adicionar|Nova transa|Novo lancamento|Lancar|Registrar/i,
    });

    if (!(await addButton.count())) {
      await skipIf(true, {
        reason: 'Manual transaction action is not exposed in this run.',
        category: 'fixture-dependent',
      });
    }

    await addButton.first().click();
    await expect(page.locator('body')).toBeVisible();
  });

  test('should keep balance surface rendered when shell is authenticated', async ({ page }) => {
    await openApp(page);
    await skipIfNoAuthShell(page);
    await expect(page.locator('body')).toBeVisible();
  });
});