import { describe, expect, it } from 'vitest';
import { buildBillingReturnUrl } from '../../src/saas/billingReturnUrl';

describe('buildBillingReturnUrl', () => {
  it('retorna root valido para tabs da SPA', () => {
    window.history.replaceState({}, '', '/');

    expect(buildBillingReturnUrl({ tab: 'settings' })).toBe(`${window.location.origin}/?billing=return&tab=settings`);
    expect(buildBillingReturnUrl({ tab: 'workspaceadmin' })).toBe(`${window.location.origin}/?billing=return&tab=workspaceadmin`);
    expect(buildBillingReturnUrl()).toBe(`${window.location.origin}/?billing=return`);
  });

  it('mantem pricing em rota dedicada', () => {
    window.history.replaceState({}, '', '/pricing');

    expect(buildBillingReturnUrl({ pricing: true })).toBe(`${window.location.origin}/pricing?billing=return`);
  });
});
