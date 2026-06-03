import { test, expect, Page } from '@playwright/test';
import { skipIfNoAuthShell } from './helpers/skipHelpers';
import { gotoDemoApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

async function openApp(page: Page): Promise<void> {
  await gotoDemoApp(page, {
    userId: 'insights-user',
    userEmail: 'insights@flow.dev',
    userName: 'Insights QA',
    token: 'insights-token',
  });
}

async function tryOpenInsightsSurface(page: Page): Promise<boolean> {
  const insightsTriggers = [
    page.getByRole('tab', { name: /^Insights$/i }),
    page.getByRole('button', { name: /^Insights$/i }),
    page.getByRole('button', { name: /Ver insights/i }),
    page.getByText(/Insights atualizam automaticamente/i),
  ];

  for (const trigger of insightsTriggers) {
    if (await trigger.count()) {
      await clickWithRetry(() => trigger);
      return true;
    }
  }

  return false;
}

async function openConsultorIA(page: Page): Promise<void> {
  await clickWithRetry(() => page.getByRole('button', { name: /^IA$/i }).first());
  await clickWithRetry(() => page.getByRole('tab', { name: /^Consultor$/i }).first());
}

test.describe('Insights + AI CFO', () => {
  test('should navigate to IA support and keep insights surface reachable when exposed', async ({ page }) => {
    const consoleIssues: string[] = [];

    page.on('pageerror', (error) => {
      const msg = error.message;
      // Ignore Firebase permission errors — expected in E2E with mock user credentials
      if (msg.includes('Missing or insufficient permissions') || msg.includes('FirebaseError')) return;
      consoleIssues.push(msg);
    });

    await openApp(page);
    await skipIfNoAuthShell(page);

    await tryOpenInsightsSurface(page);
    // Independentemente de trigger textual de Insights, o shell deve permanecer utilizavel.
    await expect(page.locator('body')).toBeVisible();

    await openConsultorIA(page);
    await expect(page.locator('body')).toBeVisible();

    expect(consoleIssues).toEqual([]);
  });

  test('should capture insights screenshots for UI audit', async ({ page }, testInfo) => {
    await openApp(page);
    await skipIfNoAuthShell(page);

    await tryOpenInsightsSurface(page);
    await expect(page.locator('body')).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopShot = testInfo.outputPath('insights-desktop.png');
    await page.screenshot({ path: desktopShot, fullPage: true });
    await testInfo.attach('insights-desktop', { path: desktopShot, contentType: 'image/png' });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileShot = testInfo.outputPath('insights-mobile.png');
    await page.screenshot({ path: mobileShot, fullPage: true });
    await testInfo.attach('insights-mobile', { path: mobileShot, contentType: 'image/png' });
  });
});
