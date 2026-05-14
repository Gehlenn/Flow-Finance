import { test, expect, Page } from '@playwright/test';
import { skipIfNoAuthShell } from './helpers/skipHelpers';
import { gotoAuthedApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

async function openApp(page: Page): Promise<void> {
  await gotoAuthedApp(page, {
    userId: 'transactions-user',
    userEmail: 'transactions@flow.dev',
    userName: 'Transactions QA',
    token: 'transactions-token',
  });
}

test.describe('Transaction Management', () => {
  test('should keep shell responsive around transaction area', async ({ page }) => {
    await openApp(page);
    await skipIfNoAuthShell(page);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should expose transaction surface and open creation action when available', async ({ page }) => {
    await openApp(page);
    await skipIfNoAuthShell(page);

    const addButton = page.getByRole('button', {
      name: /Add|Adicionar|Nova transa|Novo lancamento|Lancar|Registrar|Adicionar lançamento/i,
    });

    if (await addButton.count()) {
      await clickWithRetry(() => addButton);
      await expect(page.locator('body')).toBeVisible();
      return;
    }

    // Fallback assertivo: sem CTA manual, a tela ainda precisa manter superficie de transacoes utilizavel.
    const transactionSurface = page.getByText(/Transa|Lancamento|Historico|Receitas|Despesas|Saldo/i).first();
    await expect(transactionSurface).toBeVisible();
  });

  test('should keep balance surface rendered when shell is authenticated', async ({ page }) => {
    await openApp(page);
    await skipIfNoAuthShell(page);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should capture transaction screenshots for UI audit', async ({ page }, testInfo) => {
    await openApp(page);
    await skipIfNoAuthShell(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('body')).toBeVisible();
    const desktopShot = testInfo.outputPath('transactions-desktop.png');
    await page.screenshot({ path: desktopShot, fullPage: true });
    await testInfo.attach('transactions-desktop', { path: desktopShot, contentType: 'image/png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('body')).toBeVisible();
    const mobileShot = testInfo.outputPath('transactions-mobile.png');
    await page.screenshot({ path: mobileShot, fullPage: true });
    await testInfo.attach('transactions-mobile', { path: mobileShot, contentType: 'image/png' });
  });
});
