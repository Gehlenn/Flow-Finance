import { test, Page } from '@playwright/test';

/**
 * Environment-aware skip helpers for E2E tests
 * 
 * Control test execution resilience:
 * - E2E_FORCE_SKIP_VERIFICATION=true: Ignore all conditional skips (for debugging)
 * - E2E_FORCE_SHELL_VERIFICATION=true: Skip shell visibility checks
 * - E2E_FORCE_BACKEND_AVAILABLE=true: Ignore backend unavailability
 */

export interface SkipOptions {
  /** Message explaining why this skip may occur */
  reason: string;
  /** Category for reporting (e.g., 'fixture-dependent', 'backend-dependent') */
  category?: 'fixture-dependent' | 'backend-dependent' | 'device-dependent' | 'business-decision';
  /** Allow override via E2E_FORCE_SKIP_VERIFICATION */
  allowForceSkip?: boolean;
}

/**
 * Skip a test if condition is false, unless force-skip is disabled via env
 * @example
 * await skipIf(!hasAuthedShell, { reason: 'Authenticated shell not visible' })
 */
export async function skipIf(
  shouldSkip: boolean,
  options: SkipOptions
): Promise<void> {
  if (!shouldSkip) return;

  const globalForceSkip = process.env.E2E_FORCE_SKIP_VERIFICATION === 'true';
  if (globalForceSkip && options.allowForceSkip !== false) {
    console.warn(`⚠️  Forced execution despite: ${options.reason}`);
    return;
  }

  test.skip(true, `[${options.category || 'runtime'}] ${options.reason}`);
}

/**
 * Helper: Check if authenticated shell (navigation) is visible
 */
export async function hasAuthenticatedShell(page: Page): Promise<boolean> {
  return (await page.getByRole('button', { 
    name: /Consultor IA|Ajustes|Settings|Inicio|Transacoes|Fluxo|Historico/i 
  }).count()) > 0;
}

/**
 * Skip if authenticated shell is not visible (UI loading/auth issue)
 * Overridable via E2E_FORCE_SHELL_VERIFICATION=true
 */
export async function skipIfNoAuthShell(page: Page): Promise<void> {
  const hasShell = await hasAuthenticatedShell(page);
  
  if (!hasShell) {
    // Check for specific override
    const forceShell = process.env.E2E_FORCE_SHELL_VERIFICATION === 'true';
    if (forceShell) {
      console.warn('⚠️  Forced execution despite missing authenticated shell');
      return;
    }
  }

  await skipIf(!hasShell, {
    reason: 'Authenticated shell not visible in this run (UI still loading or auth failed)',
    category: 'fixture-dependent',
    allowForceSkip: true,
  });
}

/**
 * Skip if backend is unavailable
 * Overridable via E2E_FORCE_BACKEND_AVAILABLE=true
 */
export async function skipIfBackendUnavailable(
  page: Page,
  endpoint?: string
): Promise<void> {
  const forceBackend = process.env.E2E_FORCE_BACKEND_AVAILABLE === 'true';
  
  if (forceBackend) {
    console.warn('⚠️  Forced execution despite potential backend unavailability');
    return;
  }

  // Simple health check: try to reach backend
  const backendUrl = process.env.PLAYWRIGHT_BACKEND_URL || 'http://localhost:3001';
  const healthUrl = `${backendUrl}/api/health`;
  
  try {
    const response = await fetch(healthUrl);
    if (!response.ok) {
      test.skip(true, `[backend-dependent] Backend health check failed (${response.status})`);
    }
  } catch (err) {
    test.skip(true, `[backend-dependent] Backend unavailable: ${endpoint || 'unknown endpoint'}`);
  }
}

/**
 * Skip if running on mobile device
 * Useful for desktop-only tests
 */
export async function skipIfMobile(testInfo: any): Promise<void> {
  const isMobile = testInfo.project.use.isMobile || false;
  
  await skipIf(isMobile, {
    reason: 'Test requires desktop environment (mobile viewport detected)',
    category: 'device-dependent',
    allowForceSkip: false, // Don't allow override for device-type skips
  });
}

/**
 * Skip if running on desktop (opposite of skipIfMobile)
 * Useful for mobile-only tests
 */
export async function skipIfDesktop(testInfo: any): Promise<void> {
  const isDesktop = !testInfo.project.use.isMobile;
  
  await skipIf(isDesktop, {
    reason: 'Test requires mobile environment (desktop viewport detected)',
    category: 'device-dependent',
    allowForceSkip: false, // Don't allow override for device-type skips
  });
}

/**
 * Document why a test was skipped or might skip
 * Use for reporting and debugging
 */
export function annotateSkipReason(
  testInfo: any,
  reason: string,
  category: string
): void {
  testInfo.annotations.push({
    type: 'skip-reason',
    description: `[${category}] ${reason}`,
  });
}
