import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('developer access', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('blocks dev tools outside dev mode', async () => {
    vi.stubEnv('VITE_DEV_ACCOUNT_EMAILS', 'dev@flow.test');
    const { canAccessDeveloperTools } = await import('../../src/app/developerAccess');

    expect(canAccessDeveloperTools({ isDevMode: false, email: 'dev@flow.test' })).toBe(false);
  });

  it('allows only explicit dev account emails in dev mode', async () => {
    vi.stubEnv('VITE_DEV_ACCOUNT_EMAILS', 'dev@flow.test, admin@flow.test');
    const { canAccessDeveloperTools } = await import('../../src/app/developerAccess');

    expect(canAccessDeveloperTools({ isDevMode: true, email: 'dev@flow.test' })).toBe(true);
    expect(canAccessDeveloperTools({ isDevMode: true, email: 'demo@flowfinance.local' })).toBe(false);
  });

  it('normalizes allowlist entries and email casing before matching', async () => {
    vi.stubEnv('VITE_DEV_ACCOUNT_EMAILS', ' Dev@Flow.Test , admin@flow.test ');
    const { canAccessDeveloperTools } = await import('../../src/app/developerAccess');

    expect(
      canAccessDeveloperTools({
        isDevMode: true,
        email: '  DEV@flow.test  ',
      }),
    ).toBe(true);
  });

  it('supports an explicit local override for development sessions', async () => {
    localStorage.setItem('flow_dev_tools', '1');
    const { canAccessDeveloperTools } = await import('../../src/app/developerAccess');

    expect(canAccessDeveloperTools({ isDevMode: true, email: 'regular@flow.test' })).toBe(true);
  });
});
