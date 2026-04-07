import type { Locator } from '@playwright/test';

type ResilientClickOptions = {
  attempts?: number;
  waitBetweenMs?: number;
  timeoutPerAttemptMs?: number;
};

function isRetryableClickError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /detached from the DOM|not attached|element is not stable|Execution context was destroyed|Timeout.*locator\.click|Target closed/i.test(message);
}

export async function clickWithRetry(
  getLocator: () => Locator,
  options: ResilientClickOptions = {}
): Promise<void> {
  const attempts = options.attempts ?? 8;
  const waitBetweenMs = options.waitBetweenMs ?? 100;
  const timeoutPerAttemptMs = options.timeoutPerAttemptMs ?? 5_000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const locator = getLocator();

    try {
      await locator.first().waitFor({ state: 'visible', timeout: timeoutPerAttemptMs });
      await locator.first().dispatchEvent('click', { timeout: timeoutPerAttemptMs });
      return;
    } catch (error) {
      lastError = error;

      try {
        await locator.first().click({ timeout: timeoutPerAttemptMs, force: true });
        return;
      } catch {
        // Continue to retry path below using the original error classification.
      }

      if (!isRetryableClickError(error) || attempt === attempts) {
        throw error;
      }

      await locator.page().waitForTimeout(waitBetweenMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('clickWithRetry failed with unknown error');
}
