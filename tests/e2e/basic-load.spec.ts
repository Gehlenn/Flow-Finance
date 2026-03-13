import { test, expect } from '@playwright/test';

test.describe('Basic App Load', () => {
  test('should load the app successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/localhost:4173\/?/);

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});