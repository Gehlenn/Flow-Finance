import { test, expect, Page } from '@playwright/test';

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

async function hasAuthenticatedShell(page: Page): Promise<boolean> {
  const probes = [
    page.getByRole('button', { name: /AI CFO/i }),
    page.getByRole('button', { name: /Insights/i }),
    page.getByRole('button', { name: /Ajustes|Settings/i }),
  ];

  for (const probe of probes) {
    if (await probe.count()) return true;
  }

  return false;
}

test.describe('Insights + AI CFO', () => {
  test('should navigate to Insights and AI CFO without runtime crash', async ({ page }) => {
    const consoleIssues: string[] = [];

    page.on('pageerror', (error) => {
      consoleIssues.push(error.message);
    });

    await openApp(page);

    if (!(await hasAuthenticatedShell(page))) {
      test.skip(true, 'Authenticated shell not visible in this run.');
    }

    const insightsButton = page.getByRole('button', { name: /Insights/i }).first();
    await insightsButton.click();
    await expect(page.getByText(/Análise Financeira com IA|Insights/i).first()).toBeVisible();

    const aiCfoButton = page.getByRole('button', { name: /AI CFO/i }).first();
    await aiCfoButton.click();
    await expect(page.getByText(/Consultor Financeiro Virtual|AI CFO/i).first()).toBeVisible();

    expect(consoleIssues).toEqual([]);
  });
});