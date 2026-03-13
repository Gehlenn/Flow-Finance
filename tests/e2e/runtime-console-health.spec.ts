import { test, expect } from '@playwright/test';

const ALLOWED_WARNING_PATTERNS = [
  /Download the React DevTools/i,
  /was preloaded using link preload but not used/i,
  /Sentry DSN not found\. Error tracking disabled\./i,
  /\[API Guard\] Backend returned non-OK status: 404/i,
  /\[API Guard\] Fallback mode activated - API calls will be limited/i,
  /\[Version Guard\] Failed to fetch backend version: 404/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
];

test.describe('Runtime Console Health', () => {
  test('should load app shell without unexpected console errors/warnings', async ({ page }) => {
    const consoleIssues: Array<{ type: string; text: string }> = [];

    page.on('console', (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warning') {
        return;
      }

      const text = msg.text();
      const isAllowed = ALLOWED_WARNING_PATTERNS.some((pattern) => pattern.test(text));
      if (!isAllowed) {
        consoleIssues.push({ type, text });
      }
    });

    page.on('pageerror', (error) => {
      consoleIssues.push({ type: 'pageerror', text: error.message });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navLabels = ['Início', 'AI CFO', 'Insights', 'Open Bank', 'Ajustes'];
    for (const label of navLabels) {
      const button = page.getByRole('button', { name: label });
      if (await button.count()) {
        await button.first().click();
        await page.waitForTimeout(200);
      }
    }

    expect(consoleIssues, `Unexpected runtime console issues:\n${JSON.stringify(consoleIssues, null, 2)}`).toEqual([]);
  });
});
