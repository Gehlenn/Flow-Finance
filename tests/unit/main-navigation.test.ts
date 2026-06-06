import { describe, expect, it } from 'vitest';
import {
  getActiveNavigationSection,
  getMainNavigationItems,
  getNavigationSections,
} from '../../src/app/mainNavigation';

describe('main navigation focus', () => {
  it('keeps only product-core tabs in production mode', () => {
    const items = getMainNavigationItems(false);

    expect(items.map((item) => item.tab)).toEqual([
      'dashboard',
      'history',
      'flow',
      'cfo',
    ]);

    expect(items.some((item) => item.tab === 'openbanking')).toBe(false);
    expect(items.some((item) => item.tab === 'autopilot')).toBe(false);
  });

  it('keeps secondary surfaces discoverable as section items', () => {
    const sections = getNavigationSections(false);
    const operation = sections.find((section) => section.id === 'operation');
    const ai = sections.find((section) => section.id === 'ai');

    expect(operation?.items.map((item) => item.tab)).toEqual([
      'history',
      'import',
      'accounts',
      'goals',
    ]);
    expect(ai?.items.map((item) => item.tab)).toEqual([
      'cfo',
      'assistant',
    ]);
    expect(getActiveNavigationSection('accounts', false).id).toBe('operation');
    expect(getActiveNavigationSection('workspaceaudit', false).id).toBe('cash');
  });

  it('exposes workspace administration only to workspace admins', () => {
    const sections = getNavigationSections({
      canAccessDevTools: false,
      canAccessWorkspaceAdmin: true,
    });
    const ai = sections.find((section) => section.id === 'ai');

    expect(ai?.items.map((item) => item.tab)).toEqual([
      'cfo',
      'assistant',
      'workspaceadmin',
      'workspaceaudit',
    ]);
    expect(
      getActiveNavigationSection('workspaceaudit', {
        canAccessDevTools: false,
        canAccessWorkspaceAdmin: true,
      }).id,
    ).toBe('ai');
  });

  it('exposes dev tools only when the account has dev access', () => {
    const regularAi = getNavigationSections(false).find((section) => section.id === 'ai');
    const items = getMainNavigationItems(true);
    const ai = getNavigationSections(true).find((section) => section.id === 'ai');
    const aiItems = ai?.items ?? [];

    expect(regularAi?.items.some((item) => item.tab === 'aicontrol')).toBe(false);
    expect(regularAi?.items.some((item) => item.tab === 'performance')).toBe(false);
    expect(regularAi?.items.some((item) => item.tab === 'workspaceadmin')).toBe(false);
    expect(regularAi?.items.some((item) => item.tab === 'workspaceaudit')).toBe(false);
    expect(items.map((item) => item.tab)).toEqual(['dashboard', 'history', 'flow', 'cfo']);
    expect(aiItems[aiItems.length - 2]?.tab).toBe('aicontrol');
    expect(aiItems[aiItems.length - 2]?.label).toBe('Lab IA');
    expect(aiItems[aiItems.length - 1]?.tab).toBe('performance');
    expect(getActiveNavigationSection('aicontrol', false).id).toBe('cash');
    expect(getActiveNavigationSection('aicontrol', true).id).toBe('ai');
  });

  it('never exposes openbanking as a main nav item in any mode', () => {
    const prodItems = getMainNavigationItems(false);
    const devItems = getMainNavigationItems(true);

    expect(prodItems.some((item) => item.tab === 'openbanking')).toBe(false);
    expect(devItems.some((item) => item.tab === 'openbanking')).toBe(false);
  });
});
