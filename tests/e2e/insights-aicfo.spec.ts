import { test, expect, Page } from '@playwright/test';
import { skipIfNoAuthShell } from './helpers/skipHelpers';
import { gotoAuthedApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

async function openApp(page: Page): Promise<void> {
  await gotoAuthedApp(page, {
    userId: 'insights-user',
    userEmail: 'insights@flow.dev',
    userName: 'Insights QA',
    token: 'insights-token',
  });
}

test.describe('Insights + AI CFO', () => {
  test('should navigate to Insights and AI CFO without runtime crash', async ({ page }) => {
    const consoleIssues: string[] = [];

    page.on('pageerror', (error) => {
      const msg = error.message;
      // Ignore Firebase permission errors — expected in E2E with mock user credentials
      if (msg.includes('Missing or insufficient permissions') || msg.includes('FirebaseError')) return;
      consoleIssues.push(msg);
    });

    await openApp(page);

    await skipIfNoAuthShell(page);

    await clickWithRetry(() => page.getByRole('button', { name: /Insights/i }));
    await expect(page.getByText(/Análise Financeira com IA|Insights/i).first()).toBeVisible();

    await clickWithRetry(() => page.getByRole('button', { name: /Apoio IA|Consultor IA/i }));
    await expect(page.getByText(/Apoio Financeiro IA|Apoio consultivo para decisoes financeiras|Consultor IA/i).first()).toBeVisible();

    expect(consoleIssues).toEqual([]);
  });
});