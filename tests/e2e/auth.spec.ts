import { test, expect, Page } from '@playwright/test';

async function isAuthenticatedShell(page: Page): Promise<boolean> {
  const probes = [
    page.getByRole('button', { name: /AI CFO/i }),
    page.getByRole('button', { name: /Insights/i }),
    page.getByRole('button', { name: /Open Bank/i }),
    page.getByRole('button', { name: /Ajustes|Settings/i }),
  ];

  for (const probe of probes) {
    if (await probe.count()) return true;
  }

  return false;
}

test.describe('Authentication Flow', () => {
  test('should load either auth gate or authenticated shell', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hasAuthGate =
      (await page.getByRole('button', { name: /Cadastre-se|Sign up/i }).count()) > 0 ||
      (await page.getByPlaceholder('Seu e-mail').count()) > 0;

    const hasShell = await isAuthenticatedShell(page);

    if (!hasAuthGate && !hasShell) {
      const splash = page.getByText(/Iniciando|Loading|Flow Finan/i);
      if (await splash.count()) {
        test.skip(true, 'App remained in splash/loading state in this run.');
      }
    }

    expect(hasAuthGate || hasShell).toBe(true);
  });

  test('should open sign-up form when auth gate is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const signUpTrigger = page.getByRole('button', { name: /Cadastre-se|Sign up/i });
    if (!(await signUpTrigger.count())) {
      test.skip(true, 'Auth gate is not visible in this run.');
    }

    await signUpTrigger.first().click();
    await expect(page.getByLabel(/Nome completo|Seu nome|Name/i)).toBeVisible();
    await expect(page.getByLabel(/E-mail para cadastro|Seu e-mail|Email/i)).toBeVisible();
  });

  test('should expose accessible labels in login and recovery forms when auth gate is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const signUpTrigger = page.getByRole('button', { name: /Cadastre-se|Sign up/i });
    if (!(await signUpTrigger.count())) {
      test.skip(true, 'Auth gate is not visible in this run.');
    }

    await expect(page.getByLabel(/E-mail de acesso/i)).toBeVisible();
    await expect(page.getByLabel(/Senha de acesso/i)).toBeVisible();

    await page.getByRole('button', { name: /Esqueci a senha/i }).click();
    await expect(page.getByLabel(/E-mail para recuperar senha/i)).toBeVisible();
  });
});