import { test, expect } from '@playwright/test';

test.describe('Basic App Load', () => {
  test('should load the app successfully', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if the page has loaded by looking for any content
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toBeTruthy();

    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-screenshot.png' });

    console.log('Page loaded successfully');
    console.log('Page title:', await page.title());
    console.log('Page URL:', page.url());
  });
});