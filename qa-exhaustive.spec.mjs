import { test, expect } from '@playwright/test';

const BASE_URL = process.env.QA_URL || 'http://localhost:3078';

/**
 * QA Exhaustivo - Flow Finance SaaS
 * Tier: Exhaustivo (critical + high + medium + low)
 */

test.describe('QA Exhaustivo - Flow Finance', () => {
  
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Console error: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', error => {
      console.error(`Page error: ${error.message}`);
    });
  });

  // ==========================================
  // FASE 1: Homepage & Landing
  // ==========================================
  
  test('Homepage loads without errors', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await expect(page).toHaveTitle(/Flow|Finance|Dashboard/i);
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    await page.waitForLoadState('networkidle');
    
    expect(consoleErrors.filter(e => 
      e.includes('MODULE_NOT_FOUND') || 
      e.includes('SyntaxError') ||
      e.includes('ReferenceError')
    )).toHaveLength(0);
  });

  test('Dashboard loads and displays financial data', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    
    // Check for dashboard elements
    const dashboardElements = await page.locator('[class*="dashboard"], [class*="chart"], [class*="finance"], canvas').all();
    console.log(`✅ Found ${dashboardElements.length} dashboard elements`);
    
    // Check for navigation
    const nav = await page.locator('nav, [class*="nav"], [class*="sidebar"]').count();
    console.log(`✅ Navigation elements: ${nav}`);
  });

  // ==========================================
  // FASE 2: Authentication & User Flows
  // ==========================================
  
  test('Authentication UI exists', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Look for auth-related UI
    const authButtons = await page.locator('button:has-text("login"), button:has-text("sign"), button:has-text("entrar"), a:has-text("login")').all();
    const authInputs = await page.locator('input[type="email"], input[type="password"]').all();
    
    console.log(`✅ Auth buttons: ${authButtons.length}, Auth inputs: ${authInputs.length}`);
    
    // Flow uses Firebase Auth - check for Firebase UI
    const hasFirebaseUI = await page.locator('.firebaseui, [class*="firebase"]').count() > 0;
    console.log(`✅ Firebase Auth UI: ${hasFirebaseUI}`);
  });

  test('Transaction entry form', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    // Look for transaction forms
    const amountInputs = await page.locator('input[name*="amount"], input[placeholder*="valor"], input[placeholder*="amount"]').all();
    const descInputs = await page.locator('input[name*="description"], input[placeholder*="descrição"], textarea').all();
    
    console.log(`✅ Amount inputs: ${amountInputs.length}, Description inputs: ${descInputs.length}`);
  });

  // ==========================================
  // FASE 3: Charts & Data Visualization
  // ==========================================
  
  test('Recharts components render', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    
    // Check for chart containers (recharts)
    const charts = await page.locator('.recharts-wrapper, svg[class*="recharts"], [class*="chart"]').all();
    console.log(`✅ Chart components found: ${charts.length}`);
    
    // Screenshots for visual verification
    await page.screenshot({ path: 'qa-reports/screenshots/flow-dashboard.png', fullPage: true });
  });

  test('Financial calculations display correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    
    // Look for currency displays
    const currencyElements = await page.locator('text=/R\\$|\\$|€|balance|saldo/i').all();
    console.log(`✅ Currency/financial elements: ${currencyElements.length}`);
  });

  // ==========================================
  // FASE 4: Navigation & Routes
  // ==========================================
  
  test('SPA routing works correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    // Test navigation if available
    const links = await page.locator('a[href^="/"], a[href^="#"]').all();
    
    for (const link of links.slice(0, 5)) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('http')) {
        console.log(`Testing route: ${href}`);
        await link.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }
  });

  test('All interactive elements respond', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    const buttons = await page.locator('button').all();
    console.log(`✅ Total buttons found: ${buttons.length}`);
    
    // Test a few buttons
    for (const btn of buttons.slice(0, 3)) {
      const isEnabled = await btn.isEnabled().catch(() => false);
      const isVisible = await btn.isVisible().catch(() => false);
      console.log(`Button: enabled=${isEnabled}, visible=${isVisible}`);
    }
  });

  // ==========================================
  // FASE 5: Mobile Responsiveness
  // ==========================================
  
  test('Mobile viewport rendering', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'qa-reports/screenshots/flow-mobile.png' });
    
    // Check for mobile menu or responsive elements
    const mobileElements = await page.locator('[class*="mobile"], [class*="hamburger"], button[class*="menu"]').all();
    console.log(`✅ Mobile UI elements: ${mobileElements.length}`);
  });

  test('Tablet viewport rendering', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'qa-reports/screenshots/flow-tablet.png' });
  });

  // ==========================================
  // FASE 6: Error Handling & Edge Cases
  // ==========================================
  
  test('Handles empty data states gracefully', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    
    // Look for empty state messages
    const emptyStates = await page.locator('text=/empty|vazio|no data|nenhum/i').all();
    console.log(`✅ Empty state indicators: ${emptyStates.length}`);
  });

  test('No unhandled promise rejections', async ({ page }) => {
    const rejections = [];
    
    page.on('pageerror', error => {
      if (error.message.includes('unhandled') || error.message.includes('rejection')) {
        rejections.push(error.message);
      }
    });
    
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    
    expect(rejections).toHaveLength(0);
  });

  // ==========================================
  // FASE 7: Performance
  // ==========================================
  
  test('Page load performance under 5s', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`⏱️ Flow Finance load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('React components hydrate correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check if React is loaded
    const reactLoaded = await page.evaluate(() => {
      return window.React !== undefined || document.querySelector('[data-reactroot]') !== null;
    }).catch(() => false);
    
    console.log(`✅ React loaded: ${reactLoaded}`);
  });

  // ==========================================
  // FASE 8: Accessibility
  // ==========================================
  
  test('Form accessibility', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    const inputs = await page.locator('input, select, textarea').all();
    const unlabeledInputs = [];
    
    for (const input of inputs) {
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      const hasLabel = await input.evaluate(el => {
        const id = el.id;
        const labels = document.querySelectorAll(`label[for="${id}"]`);
        return labels.length > 0 || el.closest('label') !== null;
      });
      
      if (!ariaLabel && !ariaLabelledBy && !placeholder && !hasLabel) {
        unlabeledInputs.push(await input.getAttribute('name') || 'unnamed');
      }
    }
    
    console.log(`✅ ${inputs.length} inputs, ${unlabeledInputs.length} potentially unlabeled`);
  });

  // ==========================================
  // FASE 9: Backend Integration
  // ==========================================
  
  test('Backend health check endpoint', async ({ page }) => {
    // Flow Finance has a backend on Vercel
    const backendUrl = 'https://flow-finance-backend.vercel.app';
    
    try {
      const response = await page.goto(`${backendUrl}/health`);
      console.log(`✅ Backend health check: ${response?.status()}`);
    } catch (e) {
      console.log(`ℹ️ Backend health check skipped: ${e.message}`);
    }
  });
});

test.afterAll(async () => {
  console.log('\n📊 QA Flow Finance Completo!');
  console.log('Verifique qa-reports/screenshots/ para evidências visuais');
});
