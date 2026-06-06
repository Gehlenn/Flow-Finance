import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  reportError: vi.fn(),
  reportMessage: vi.fn(),
}));

vi.mock('../../src/config/sentry', () => ({
  addBreadcrumb: loggerMocks.addBreadcrumb,
  reportError: loggerMocks.reportError,
  reportMessage: loggerMocks.reportMessage,
}));

import { logWarn } from '../../src/utils/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('redacts workspace, tenant, user and email identifiers before reporting', () => {
    logWarn('[Billing] Failed', {
      workspaceId: 'ws-secret',
      tenant_id: 'tenant-secret',
      memberUserId: 'user-secret',
      ownerEmail: 'owner@example.com',
      eventName: 'billing_checkout_failed',
      nested: {
        removedByUserId: 'user-remover',
        apiKey: 'api-secret',
      },
    });

    expect(loggerMocks.reportMessage).toHaveBeenCalledWith(
      '[Billing] Failed',
      'warning',
      expect.objectContaining({
        level: 'WARN',
        data: {
          workspaceId: '[REDACTED]',
          tenant_id: '[REDACTED]',
          memberUserId: '[REDACTED]',
          ownerEmail: '[REDACTED]',
          eventName: 'billing_checkout_failed',
          nested: {
            removedByUserId: '[REDACTED]',
            apiKey: '[REDACTED]',
          },
        },
      }),
    );
    expect(console.warn).toHaveBeenCalledWith(
      '[WARN]',
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: '[REDACTED]',
          eventName: 'billing_checkout_failed',
        }),
      }),
    );
  });
});
