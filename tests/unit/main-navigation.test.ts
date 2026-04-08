import { describe, expect, it } from 'vitest';
import { getMainNavigationItems } from '../../src/app/mainNavigation';

describe('main navigation focus', () => {
  it('keeps only product-core tabs in production mode', () => {
    const items = getMainNavigationItems(false);

    expect(items.map((item) => item.tab)).toEqual([
      'dashboard',
      'history',
      'flow',
      'cfo',
      'settings',
    ]);

    expect(items.some((item) => item.tab === 'openbanking')).toBe(false);
    expect(items.some((item) => item.tab === 'accounts')).toBe(false);
    expect(items.some((item) => item.tab === 'insights')).toBe(false);
    expect(items.some((item) => item.tab === 'autopilot')).toBe(false);
    expect(items.some((item) => item.tab === 'analytics')).toBe(false);
    expect(items.some((item) => item.tab === 'import')).toBe(false);
  });

  it('exposes ai control only in dev mode', () => {
    const items = getMainNavigationItems(true);

    expect(items[items.length - 1]?.tab).toBe('aicontrol');
  });

  it('never exposes openbanking as a main nav item in any mode', () => {
    const prodItems = getMainNavigationItems(false);
    const devItems = getMainNavigationItems(true);

    expect(prodItems.some((item) => item.tab === 'openbanking')).toBe(false);
    expect(devItems.some((item) => item.tab === 'openbanking')).toBe(false);
  });
});
