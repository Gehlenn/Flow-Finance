import { test, expect } from '@playwright/test';
import { skipIf } from './helpers/skipHelpers';
import { gotoAuthedApp } from './helpers/appBootstrap';
import { clickWithRetry } from './helpers/resilientActions';

test.describe('Edição de Categoria - TransactionList', () => {
  test('Usuário edita categoria de uma transação e recebe feedback visual', async ({ page }) => {
    await gotoAuthedApp(page, {
      userId: 'tx-user',
      userEmail: 'tx@flow.dev',
      userName: 'TX QA',
      token: 'tx-token',
    });

    const historyButton = page.getByRole('button', { name: /Historico/i });
    if (!(await historyButton.count())) {
      await skipIf(true, {
        reason: 'Shell autenticado não expôs o histórico nesta execução.',
        category: 'fixture-dependent',
      });
    }

    await clickWithRetry(() => historyButton);

    // Espera o histórico carregar
    await expect(page.getByText('Histórico')).toBeVisible();

    // Seleciona uma transação de teste (ajuste o texto conforme seed)
    const txDesc = 'Restaurante';
    if (!(await page.getByText(txDesc).count())) {
      const addButton = page.getByRole('button', { name: /Adicionar lançamento/i });
      if (!(await addButton.count())) {
        await skipIf(true, {
          reason: 'CTA de criação manual não ficou disponível nesta execução local.',
          category: 'fixture-dependent',
        });
      }

      await clickWithRetry(() => addButton);
      await clickWithRetry(() => page.getByRole('button', { name: /Lançamento Manual/i }));
      await page.getByPlaceholder('Ex: Mercado Mensal').fill(txDesc);
      await page.getByPlaceholder('0,00').first().fill('42');
      await clickWithRetry(() => page.getByRole('button', { name: /Salvar Lançamento/i }));
      await page.waitForTimeout(1800);

      await clickWithRetry(() => historyButton);
      await expect(page.getByText('Histórico')).toBeVisible();
    }
    await clickWithRetry(() => page.getByText(txDesc));

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
    await expect(page.getByRole('status')).not.toBeVisible();
  });
});
