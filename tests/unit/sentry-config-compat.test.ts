import { beforeEach, describe, expect, it, vi } from 'vitest';

const withScopeMock = vi.fn();
const captureExceptionMock = vi.fn();
const captureMessageMock = vi.fn();
const setUserMock = vi.fn();
const addBreadcrumbMock = vi.fn();

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  withScope: (callback: (scope: { setTag: (key: string, value: unknown) => void }) => void) => {
    withScopeMock(callback);
    callback({
      setTag: vi.fn(),
    });
  },
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
  setUser: (...args: unknown[]) => setUserMock(...args),
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbMock(...args),
}));

describe('sentry config compat', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.com/1');
  });

  it('reports errors and messages through the typed Sentry adapter', async () => {
    const { reportError, reportMessage, setUser, clearUser, addBreadcrumb } = await import('../../src/config/sentry');

    reportError(new Error('boom'), { scope: 'panel', count: 3 });
    reportMessage('hello', 'warning', { scope: 'queue' });
    setUser({ id: 'u-1', email: 'user@example.com' });
    clearUser();
    addBreadcrumb('refresh', 'queue', 'info');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(withScopeMock).toHaveBeenCalledTimes(2);
    expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error));
    expect(captureMessageMock).toHaveBeenCalledWith('hello', 'warning');
    expect(setUserMock).toHaveBeenCalledWith({ id: 'u-1', email: 'user@example.com', username: undefined });
    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      message: 'refresh',
      category: 'queue',
      level: 'info',
    });
  });
});
