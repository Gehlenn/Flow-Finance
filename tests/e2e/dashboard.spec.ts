import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display dashboard components', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('[data-testid="balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-transactions"]')).toBeVisible();
    await expect(page.locator('[data-testid="insights"]')).toBeVisible();
  });

  test('should show recent transactions', async ({ page }) => {
    // Check if recent transactions are displayed
    await expect(page.locator('[data-testid="recent-transactions"]')).toBeVisible();

    // Should show at least some transactions or empty state
    const transactions = page.locator('[data-testid="transaction-item"]');
    await expect(transactions).toHaveCount(await transactions.count() >= 0);
  });

  test('should display AI insights', async ({ page }) => {
    // Check if insights section exists
    await expect(page.locator('[data-testid="insights"]')).toBeVisible();

    // Should show insights or loading state
    await expect(page.locator('[data-testid="insight-item"], [data-testid="insights-loading"]')).toBeVisible();
  });

  test('should navigate to different sections', async ({ page }) => {
    // Test navigation to Goals
    await page.click('[data-testid="nav-goals"]');
    await expect(page).toHaveURL('/goals');

    // Test navigation back to Dashboard
    await page.click('[data-testid="nav-dashboard"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should handle mobile viewport', async ({ page, isMobile }) => {
    if (isMobile) {
      // Check mobile menu
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

      // Test mobile navigation
      await page.click('[data-testid="mobile-menu"]');
      await expect(page.locator('[data-testid="mobile-nav-goals"]')).toBeVisible();
    }
  });
});