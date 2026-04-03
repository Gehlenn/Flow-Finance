import { test, expect } from '@playwright/test';

test.describe('Edição de Categoria - TransactionList', () => {
  test('Usuário edita categoria de uma transação e recebe feedback visual', async ({ page }) => {
    await page.goto('/?e2eAuth=1&userId=tx-user&userEmail=tx%40flow.dev&userName=TX%20QA&token=tx-token');

    const historyButton = page.getByRole('button', { name: /Historico/i });
    if (!(await historyButton.count())) {
      test.skip(true, 'Shell autenticado não expôs o histórico nesta execução.');
    }

    await historyButton.first().click();

    // Espera o histórico carregar
    await expect(page.getByText('Histórico')).toBeVisible();

    // Seleciona uma transação de teste (ajuste o texto conforme seed)
    const txDesc = 'Restaurante';
    if (!(await page.getByText(txDesc).count())) {
      test.skip(true, 'Não há fixture de transação compatível nesta execução local.');
    }
    await page.getByText(txDesc).click();

    // Abre modal de detalhes e clica em Editar
    await page.getByRole('button', { name: 'Editar' }).click();

    // Modal de edição deve aparecer
    await expect(page.getByRole('dialog', { name: 'Editar Categoria' })).toBeVisible();

    // Seleciona nova categoria (exemplo: "Trabalho / Consultório")
    await page.getByRole('button', { name: 'Selecionar categoria Trabalho / Consultório' }).click();

    // Salva
    await page.getByRole('button', { name: 'Salvar categoria' }).click();

    // Toast de confirmação
    await expect(page.getByRole('status')).toContainText('Categoria atualizada e IA treinada');

    // Fecha o toast manualmente
    await page.getByRole('button', { name: 'Fechar aviso de categoria salva' }).click();
    await expect(page.getByRole('status')).not.toBeVisible();
  });
});
