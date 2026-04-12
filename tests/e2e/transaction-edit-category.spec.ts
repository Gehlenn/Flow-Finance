import { test, expect } from '@playwright/test';
import { skipIf } from './helpers/skipHelpers';
import { gotoAuthedApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

test.describe('Edição de Categoria - TransactionList', () => {
  test('Usuário edita categoria de uma transação e recebe feedback visual', async ({ page }) => {
    await page.addInitScript(() => {
      const prefixes = [
        'flow_searchQuery:',
        'flow_showFilters:',
        'flow_categoryFilter:',
        'flow_dateStart:',
        'flow_dateEnd:',
        'flow_sortConfig:',
      ];

      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (prefixes.some((prefix) => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    });

    await gotoAuthedApp(page, {
      userId: 'tx-user',
      userEmail: 'tx@flow.dev',
      userName: 'TX QA',
      token: 'tx-token',
    });

    const historyButton = page.getByRole('button', { name: /Historico|Transacoes/i }).first();
    await expect(historyButton).toBeVisible({ timeout: 10000 });

    await clickWithRetry(() => historyButton);

    // Espera o histórico carregar
    await expect(page.getByText('Histórico')).toBeVisible();

    // Garante ao menos uma transação disponível para edição
    const transactionTitles = page.locator('h4.font-bold');
    if ((await transactionTitles.count()) === 0) {
      const txDesc = 'Restaurante';
      const addButton = page.getByRole('button', { name: /Adicionar lançamento/i });
      await expect(addButton).toBeVisible({ timeout: 10000 });

      await clickWithRetry(() => addButton);
      await clickWithRetry(() => page.getByRole('button', { name: /Lançamento Manual/i }));
      await page.getByPlaceholder('Ex: Mercado Mensal').fill(txDesc);
      await page.getByPlaceholder('0,00').first().fill('42');
      await clickWithRetry(() => page.getByRole('button', { name: /Salvar Lançamento/i }));
      await page.waitForTimeout(1800);

      await clickWithRetry(() => historyButton);
      await expect(page.getByText('Histórico')).toBeVisible();
      await page.waitForTimeout(2000);
    }

    const firstTransactionTitle = page.locator('h4.font-bold').first();
    if (!(await firstTransactionTitle.count())) {
      await skipIf(true, {
        reason: 'Nenhuma transação ficou disponível no histórico mesmo após criação manual.',
        category: 'fixture-dependent',
      });
    }

    await expect(firstTransactionTitle).toBeVisible({ timeout: 10000 });
    await clickWithRetry(() => firstTransactionTitle);

    // Abre modal de detalhes e clica em Editar
    await clickWithRetry(() => page.getByRole('button', { name: 'Editar' }));

    // Modal de edição deve aparecer
    await expect(page.getByRole('dialog', { name: 'Editar Categoria' })).toBeVisible();

    // Seleciona nova categoria (exemplo: "Trabalho / Consultório")
    await clickWithRetry(() => page.getByRole('button', { name: 'Selecionar categoria Trabalho / Consultório' }));

    // Salva
    await clickWithRetry(() => page.getByRole('button', { name: 'Salvar categoria' }));

    // Toast de confirmação
    await expect(page.getByRole('status')).toContainText('Categoria atualizada e IA treinada');

    // Fecha o toast manualmente
    await clickWithRetry(() => page.getByRole('button', { name: 'Fechar aviso de categoria salva' }));
    const categoryToast = page.getByRole('status');
    await expect(categoryToast).toHaveClass(/opacity-0/);
    await expect(categoryToast).toHaveClass(/pointer-events-none/);
  });
});
