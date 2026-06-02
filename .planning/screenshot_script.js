import { chromium, devices } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:3078', { waitUntil: 'networkidle', timeout: 5000 });
    
    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: '.planning/ui-reviews/manual-20260512-233409/desktop.png' });
    
    // Mobile
    await page.setViewportSize(devices['iPhone 12'].viewport);
    await page.screenshot({ path: '.planning/ui-reviews/manual-20260512-233409/mobile.png' });
    
    // Tablet
    await page.setViewportSize(devices['iPad Pro 11'].viewport);
    await page.screenshot({ path: '.planning/ui-reviews/manual-20260512-233409/tablet.png' });
    
    console.log('Screenshots captured successfully');
  } catch (e) {
    console.error('Failed to capture screenshots:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
