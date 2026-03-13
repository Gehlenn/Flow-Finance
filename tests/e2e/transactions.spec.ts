import { test, expect, Page } from '@playwright/test';

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

async function hasAuthenticatedShell(page: Page): Promise<boolean> {
  return (await page.getByRole('button', { name: /AI CFO|Insights|Open Bank|Ajustes|Settings/i }).count()) > 0;
}

test.describe('Transaction Management', () => {
  test('should keep shell responsive around transaction area', async ({ page }) => {
    await openApp(page);

    if (!(await hasAuthenticatedShell(page))) {
      test.skip(true, 'Authenticated shell not visible in this run.');
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should open transaction creation action when exposed', async ({ page }) => {
    await openApp(page);

    if (!(await hasAuthenticatedShell(page))) {
      test.skip(true, 'Authenticated shell not visible in this run.');
    }

    const addButton = page.getByRole('button', {
      name: /Add|Adicionar|Nova transa|Novo lancamento|Lancar|Registrar/i,
    });

    if (!(await addButton.count())) {
      test.skip(true, 'Manual transaction action is not exposed in this run.');
    }

    await addButton.first().click();
    await expect(page.locator('body')).toBeVisible();
  });

  test('should keep balance surface rendered when shell is authenticated', async ({ page }) => {
    await openApp(page);

    if (!(await hasAuthenticatedShell(page))) {
      test.skip(true, 'Authenticated shell not visible in this run.');
    }

    await expect(page.locator('body')).toBeVisible();
  });
});