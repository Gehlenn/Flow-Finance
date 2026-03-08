import { test, expect } from '@playwright/test';

test.describe('Performance Monitor', () => {
  test('should display performance metrics', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');

    // Wait for the app to load
    await page.waitForTimeout(2000);

    // Check if we're on the login page or main app
    const isLoginPage = await page.locator('text=Flow Finance').isVisible().catch(() => false);

    if (isLoginPage) {
      // If on login page, use the quick test login
      await page.click('text=Teste Rápido');
      await page.waitForTimeout(1000);
    }

    // Wait for dashboard to load
    await page.waitForTimeout(2000);

    // Look for performance tab/button
    const performanceTab = page.locator('text=Performance').first();
    await expect(performanceTab).toBeVisible({ timeout: 10000 });

    // Click on performance tab
    await performanceTab.click();

    // Wait for performance monitor to load
    await page.waitForTimeout(2000);

    // Check for performance score
    const performanceScore = page.locator('text=Performance Score').first();
    await expect(performanceScore).toBeVisible();

    // Check for Core Web Vitals section
    const coreVitals = page.locator('text=Core Web Vitals').first();
    await expect(coreVitals).toBeVisible();

    // Check for some performance metrics
    await expect(page.locator('text=Largest Contentful Paint').first()).toBeVisible();
    await expect(page.locator('text=First Input Delay').first()).toBeVisible();
    await expect(page.locator('text=Cumulative Layout Shift').first()).toBeVisible();
  });
});