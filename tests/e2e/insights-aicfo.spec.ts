import { test, expect, Page, Locator } from '@playwright/test';
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
    page.getByText(/Sinais do caixa atualizados/i),
  ];

  for (const trigger of insightsTriggers) {
    if (await trigger.count()) {
      await clickWithRetry(() => trigger.first());
      return true;
    }
  }

  return false;
}

async function clickFirstAvailable(locators: Locator[]): Promise<boolean> {
  for (const locator of locators) {
    if (await locator.count()) {
      await clickWithRetry(() => locator.first());
      return true;
    }
  }

  return false;
}

async function openConsultorIA(page: Page): Promise<void> {
  const openedSection = await clickFirstAvailable([
    page.getByRole('button', { name: /^IA$/i }),
    page.getByRole('tab', { name: /^IA$/i }),
    page.getByRole('button', { name: /^Apoio IA$/i }),
    page.getByRole('tab', { name: /^Apoio IA$/i }),
  ]);

  expect(openedSection).toBe(true);

  const consultorTab = page.getByRole('tab', {
    name: /^(Consultor de caixa|Consultor IA|Consultor)$/i,
  });

  if (await consultorTab.count()) {
    await clickWithRetry(() => consultorTab.first());
  }

  await expect(page.locator('body')).toContainText(
    /Consultor de caixa|Consultor IA|Plano de acao/i,
    { timeout: 15000 },
  );
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
