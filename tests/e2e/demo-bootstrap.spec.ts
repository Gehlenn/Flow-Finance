import { expect, test } from '@playwright/test';
import { gotoDemoApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

const ALLOWED_WARNING_PATTERNS = [
  /Download the React DevTools/i,
  /was preloaded using link preload but not used/i,
  /Sentry DSN not found\. Error tracking disabled\./i,
  /\[Firebase\] Web auth\/Firestore disabled/i,
  /^\[WARN\] JSHandle@object$/i,
  /\[API Guard\] Backend returned non-OK status: 404/i,
  /\[Version Guard\] Failed to fetch backend version: 404/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
  /va\.vercel-scripts\.com\/v1\/script\.debug\.js/i,
  /OpaqueResponseBlocking/i,
  /A resource is blocked by OpaqueResponseBlocking/i,
  /Loading failed for the <script> with source/i,
  /Failed to load resource: the server responded with a status of 403/i,
];

function isAllowedConsoleIssue(text: string): boolean {
  return ALLOWED_WARNING_PATTERNS.some((pattern) => pattern.test(text));
}

test.describe('Demo bootstrap', () => {
  test('loads the app shell without workspace permission errors', async ({ page }) => {
    const consoleIssues: Array<{ type: string; text: string }> = [];

    page.on('console', (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warning') {
        return;
      }

      const text = msg.text();
      if (!isAllowedConsoleIssue(text)) {
        consoleIssues.push({ type, text });
      }
    });

    page.on('pageerror', (error) => {
      consoleIssues.push({ type: 'pageerror', text: error.message });
    });

    await gotoDemoApp(page);
    await expect(page.getByText('Leitura rapida do caixa')).toBeVisible();

    const navLabels = ['Caixa', 'Operacao', 'Receitas', 'Decisao'];
    for (const label of navLabels) {
      const button = page.getByRole('button', { name: label });
      if (await button.count()) {
        await clickWithRetry(() => button);
        await page.waitForTimeout(150);
      }
    }

    expect(consoleIssues, `Unexpected runtime console issues:\n${JSON.stringify(consoleIssues, null, 2)}`).toEqual([]);
  });
});
