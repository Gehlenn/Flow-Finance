import { describe, expect, it } from 'vitest';

import {
  getActiveTabContainerClass,
  getShellContentSpacingClass,
  shouldShowFloatingEntryButton,
  shouldShowTopStatus,
} from '../../src/app/appShellLayout';

describe('appShellLayout', () => {
  it('mantem a regra de status superior isolada da renderizacao do App', () => {
    expect(shouldShowTopStatus({ isDemoBootstrapActive: true, syncStatus: 'idle' })).toBe(true);
    expect(shouldShowTopStatus({ isDemoBootstrapActive: false, syncStatus: 'syncing' })).toBe(true);
    expect(shouldShowTopStatus({ isDemoBootstrapActive: false, syncStatus: 'synced' })).toBe(true);
    expect(shouldShowTopStatus({ isDemoBootstrapActive: false, syncStatus: 'error' })).toBe(true);
    expect(shouldShowTopStatus({ isDemoBootstrapActive: false, syncStatus: 'idle' })).toBe(false);
  });

  it('preserva largura e espaco do shell por tipo de aba', () => {
    expect(getActiveTabContainerClass('dashboard')).toBe('max-w-6xl');
    expect(getActiveTabContainerClass('history')).toBe('max-w-6xl');
    expect(getActiveTabContainerClass('flow')).toBe('max-w-6xl');
    expect(getActiveTabContainerClass('cfo')).toBe('max-w-4xl');
    expect(getActiveTabContainerClass('settings')).toBe('max-w-xl');

    expect(getShellContentSpacingClass(true)).toBe('pt-12 md:pt-16');
    expect(getShellContentSpacingClass(false)).toBe('pt-4 md:pt-5');
  });

  it('mantem o FAB restrito ao dashboard', () => {
    expect(shouldShowFloatingEntryButton('dashboard')).toBe(true);
    expect(shouldShowFloatingEntryButton('flow')).toBe(false);
    expect(shouldShowFloatingEntryButton('cfo')).toBe(false);
  });
});
