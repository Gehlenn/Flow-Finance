import { test, expect } from '@playwright/test';

// Ajuste o caminho conforme a rota real do app
const APP_URL = 'http://localhost:3000';

test.describe('Edição de Categoria - TransactionList', () => {
  test('Usuário edita categoria de uma transação e recebe feedback visual', async ({ page }) => {
    await page.goto(APP_URL);

    // Espera o histórico carregar
    await expect(page.getByText('Histórico')).toBeVisible();

    // Seleciona uma transação de teste (ajuste o texto conforme seed)
    const txDesc = 'Restaurante';
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
