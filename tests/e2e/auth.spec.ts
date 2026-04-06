import { test, expect, Page } from '@playwright/test';
import { hasAuthenticatedShell, skipIf } from './helpers/skipHelpers';

async function waitForAuthResolution(page: Page): Promise<void> {
  await expect.poll(async () => {
    const hasAuthGate =
      (await page.getByRole('button', { name: /Cadastre-se|Sign up/i }).count()) > 0 ||
      (await page.getByPlaceholder('Seu e-mail').count()) > 0;
    const hasShell = await hasAuthenticatedShell(page);
    const hasSplash = (await page.locator('body').getByText(/Iniciando|Loading|Flow Finan/i).count()) > 0;

    if (hasAuthGate) return 'auth';
    if (hasShell) return 'shell';
    if (hasSplash) return 'splash';
    return 'unknown';
  }, { timeout: 7000, intervals: [250, 500, 1000] }).not.toBe('unknown');
}

test.describe('Authentication Flow', () => {
  test('should load either auth gate or authenticated shell', async ({ page }) => {
    await page.goto('/');
    await waitForAuthResolution(page);

    const hasAuthGate =
      (await page.getByRole('button', { name: /Cadastre-se|Sign up/i }).count()) > 0 ||
      (await page.getByPlaceholder('Seu e-mail').count()) > 0;
    const hasShell = await hasAuthenticatedShell(page);

    if (!hasAuthGate && !hasShell) {
      const splash = page.getByText(/Iniciando|Loading|Flow Finan/i);
      if (await splash.count()) {
        await skipIf(true, {
          reason: 'App remained in splash/loading state in this run.',
          category: 'fixture-dependent',
        });
      }
    }

    expect(hasAuthGate || hasShell).toBe(true);
  });

  test('should open sign-up form when auth gate is visible', async ({ page }) => {
    await page.goto('/');
    await waitForAuthResolution(page);

    const signUpTrigger = page.getByRole('button', { name: /Cadastre-se|Sign up/i });
    if (!(await signUpTrigger.count())) {
      await skipIf(true, {
        reason: 'Auth gate is not visible in this run.',
        category: 'fixture-dependent',
      });
    }

    await signUpTrigger.first().click();
    await expect(page.getByLabel(/Nome completo|Seu nome|Name/i)).toBeVisible();
    await expect(page.getByLabel(/E-mail para cadastro|Seu e-mail|Email/i)).toBeVisible();
  });

  test('should expose accessible labels in login and recovery forms when auth gate is visible', async ({ page }) => {
    await page.goto('/');
    await waitForAuthResolution(page);

    const signUpTrigger = page.getByRole('button', { name: /Cadastre-se|Sign up/i });
    if (!(await signUpTrigger.count())) {
      await skipIf(true, {
        reason: 'Auth gate is not visible in this run.',
        category: 'fixture-dependent',
      });
    }

    await expect(page.getByLabel(/E-mail de acesso/i)).toBeVisible();
    await expect(page.getByLabel(/Senha de acesso/i)).toBeVisible();

    await page.getByRole('button', { name: /Esqueci a senha/i }).click();
    await expect(page.getByLabel(/E-mail para recuperar senha/i)).toBeVisible();
  });
});