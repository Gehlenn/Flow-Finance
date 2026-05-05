import { describe, expect, it } from 'vitest';
import { canPerform } from '../../shared/policyEngine';

describe('policyEngine AI permissions', () => {
  it('allows viewer to use AI (still gated by workspace + quota)', () => {
    expect(
      canPerform({ userId: 'u1', role: 'viewer', plan: 'free' }, 'ai:use'),
    ).toBe(true);
  });

  it('still denies viewer transaction writes', () => {
    expect(
      canPerform({ userId: 'u1', role: 'viewer', plan: 'free' }, 'transactions:create'),
    ).toBe(false);
  });
});

