import { test, expect, Page } from '@playwright/test';
import { skipIfNoAuthShell } from './helpers/skipHelpers';

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

test.describe('Insights + AI CFO', () => {
  test('should navigate to Insights and AI CFO without runtime crash', async ({ page }) => {
    const consoleIssues: string[] = [];

    page.on('pageerror', (error) => {
      consoleIssues.push(error.message);
    });

    await openApp(page);

    await skipIfNoAuthShell(page);

    const insightsButton = page.getByRole('button', { name: /Insights/i }).first();
    await insightsButton.click();
    await expect(page.getByText(/Análise Financeira com IA|Insights/i).first()).toBeVisible();

    const aiCfoButton = page.getByRole('button', { name: /AI CFO/i }).first();
    await aiCfoButton.click();
    await expect(page.getByText(/Consultor Financeiro Virtual|AI CFO/i).first()).toBeVisible();

    expect(consoleIssues).toEqual([]);
  });
});