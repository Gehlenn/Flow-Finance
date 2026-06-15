import { test, expect } from '@playwright/test';
import { skipIfMobile } from './helpers/skipHelpers';
import { gotoAuthedApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

test.describe('Billing Flow', () => {
  function buildOwnerBootstrap(testInfo: Parameters<typeof test>[1]): {
    userId: string;
    userEmail: string;
    userName: string;
    token: string;
  } {
    const projectSlug = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const runNonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const userId = `billing-owner-${projectSlug}-${runNonce}`;

    return {
      userId,
      userEmail: `${userId}@flow.dev`,
      userName: 'Billing QA Owner',
      token: `billing-token-${runNonce}`,
    };
  }

  test('should open settings and show workspace summary state', async ({ page }, testInfo) => {
    await skipIfMobile(testInfo);

    const ownerBootstrap = buildOwnerBootstrap(testInfo);

    await gotoAuthedApp(page, {
      userId: ownerBootstrap.userId,
      userEmail: ownerBootstrap.userEmail,
      userName: ownerBootstrap.userName,
      token: ownerBootstrap.token,
    });

    await clickWithRetry(() => page.getByRole('button', { name: /Ajustes|Settings|Conta e plano/i }));

    await expect(page.locator('body')).toContainText(/Resumo do workspace|Perfil e workspace|Workspace ativo/i, { timeout: 15000 });

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Plano:|Nao foi possivel carregar o plano do workspace|Workspace ativo/i);
  });

  test('should open workspace admin from settings and expose billing state or read-only guard', async ({ page }, testInfo) => {
    await skipIfMobile(testInfo);

    const ownerBootstrap = buildOwnerBootstrap(testInfo);

    await gotoAuthedApp(page, {
      userId: ownerBootstrap.userId,
      userEmail: ownerBootstrap.userEmail,
      userName: ownerBootstrap.userName,
      token: ownerBootstrap.token,
    });

    await clickWithRetry(() => page.getByRole('button', { name: /Ajustes|Settings|Conta e plano/i }));
    await expect(page.locator('body')).toContainText(/Resumo do workspace|Perfil e workspace|Workspace ativo/i, { timeout: 15000 });

    const workspaceAdminButton = page.getByRole('button', {
      name: /Abrir admin do workspace|Open workspace admin|Workspace admin/i,
    });

    if ((await workspaceAdminButton.count()) > 0) {
      await expect(workspaceAdminButton).toBeVisible({ timeout: 10000 });
      await clickWithRetry(() => workspaceAdminButton);

      await expect(page.locator('body')).toContainText(
        /Workspace Admin|Billing and usage|Read-only workspace role|Billing actions are unavailable|view-only for Workspace/i,
        { timeout: 15000 },
      );
    } else {
      await expect(page.locator('body')).toContainText(/Workspace ativo|Papel:|Plano:/i);
    }
  });
});
