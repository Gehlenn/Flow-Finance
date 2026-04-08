import { test, expect } from '@playwright/test';
import { skipIfMobile } from './helpers/skipHelpers';
import { gotoAuthedApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

test.describe('Billing Flow', () => {
  test('should open settings and show workspace summary state', async ({ page }, testInfo) => {
    await skipIfMobile(testInfo);

    await gotoAuthedApp(page, {
      userId: 'billing-user',
      userEmail: 'billing@flow.dev',
      userName: 'Billing QA',
      token: 'billing-token',
    });

    await clickWithRetry(() => page.getByRole('button', { name: /Ajustes/i }));

    await expect(page.getByRole('heading', { name: /Ajustes/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).toContainText(/Resumo do workspace|Perfil e workspace/i);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Plano:|Nao foi possivel carregar o plano do workspace|Workspace ativo/i);
  });

  test('should open workspace admin from settings for owner bootstrap', async ({ page }, testInfo) => {
    await skipIfMobile(testInfo);

    await gotoAuthedApp(page, {
      userId: 'billing-user',
      userEmail: 'billing@flow.dev',
      userName: 'Billing QA',
      token: 'billing-token',
    });

    await clickWithRetry(() => page.getByRole('button', { name: /Ajustes/i }));
    await expect(page.getByRole('heading', { name: /Ajustes/i })).toBeVisible({ timeout: 10000 });

    const workspaceAdminButton = page.getByRole('button', { name: /Abrir admin do workspace|Open workspace admin/i });
    await expect(workspaceAdminButton).toBeVisible({ timeout: 10000 });
    await clickWithRetry(() => workspaceAdminButton);

    await expect(page.getByRole('heading', { name: /Workspace Admin/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).toContainText(/Workspace Admin|Billing and usage|Read-only workspace role/i);
  });
});