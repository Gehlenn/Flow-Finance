import { test, expect } from '@playwright/test';
import { clickWithRetry } from './helpers/resilientActions';

test.describe('Performance Monitor', () => {
  test('should expose browser performance entries after app load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navToSettings = page.getByRole('button', { name: 'Ajustes' });
    if (await navToSettings.count()) {
      await clickWithRetry(() => navToSettings);
    }

    const performanceEntries = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    expect(performanceEntries).toBeGreaterThan(0);
  });
});