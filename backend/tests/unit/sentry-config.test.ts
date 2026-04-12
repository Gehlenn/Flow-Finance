import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryInitMock = vi.fn();
const sentrySetContextMock = vi.fn();
const sentrySetUserMock = vi.fn();
const sentryAddBreadcrumbMock = vi.fn();
const sentryWithScopeMock = vi.fn();
const sentryCaptureExceptionMock = vi.fn();
const sentryCaptureMessageMock = vi.fn();

vi.mock('@sentry/node', () => ({
  init: sentryInitMock,
  setContext: sentrySetContextMock,
  setUser: sentrySetUserMock,
  addBreadcrumb: sentryAddBreadcrumbMock,
  withScope: sentryWithScopeMock,
  captureException: sentryCaptureExceptionMock,
  captureMessage: sentryCaptureMessageMock,
}));

vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: vi.fn(() => ({ name: 'profiling' })),
}));

describe('backend sentry config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_DEV_ENABLED;
    process.env.NODE_ENV = 'test';
  });

  it('reports configuration state and stays silent without DSN', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { initSentry, isSentryConfigured } = await import('../../src/config/sentry');

    expect(isSentryConfigured()).toBe(false);
    initSentry();

    expect(sentryInitMock).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalledWith('Sentry DSN not found. Backend error tracking disabled.');
  });
});
