import { test, expect } from '@playwright/test';

test.describe('Transaction Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should add new transaction', async ({ page }) => {
    // Navigate to add transaction
    await page.click('[data-testid="add-transaction"]');

    // Fill transaction form
    await page.fill('[data-testid="description"]', 'Compra no mercado');
    await page.fill('[data-testid="amount"]', '150.50');
    await page.selectOption('[data-testid="category"]', 'ALIMENTACAO');
    await page.fill('[data-testid="date"]', '2026-03-08');

    // Submit transaction
    await page.click('[data-testid="save-transaction"]');

    // Verify transaction appears in list
    await expect(page.locator('text=Compra no mercado')).toBeVisible();
    await expect(page.locator('text=R$ 150,50')).toBeVisible();
  });

  test('should categorize transaction automatically', async ({ page }) => {
    // Add transaction with AI categorization
    await page.click('[data-testid="add-transaction"]');
    await page.fill('[data-testid="description"]', 'Pagamento conta luz');
    await page.fill('[data-testid="amount"]', '89.90');

    // Wait for AI categorization
    await expect(page.locator('[data-testid="category"]')).toHaveValue('UTILIDADES');

    // Submit and verify
    await page.click('[data-testid="save-transaction"]');
    await expect(page.locator('text=Pagamento conta luz')).toBeVisible();
  });

  test('should calculate balance correctly', async ({ page }) => {
    // Check initial balance
    const initialBalance = await page.locator('[data-testid="balance"]').textContent();

    // Add income transaction
    await page.click('[data-testid="add-transaction"]');
    await page.fill('[data-testid="description"]', 'Salário');
    await page.fill('[data-testid="amount"]', '3500.00');
    await page.selectOption('[data-testid="type"]', 'income');
    await page.click('[data-testid="save-transaction"]');

    // Verify balance updated
    await expect(page.locator('[data-testid="balance"]')).not.toHaveText(initialBalance);
  });
});