import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('runtime guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats missing API health endpoint as benign in frontend-only environments', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { checkAPIHealth } = await import('../../src/runtime/apiGuard');
    const result = await checkAPIHealth();

    expect(result.status).toBe('ok');
    expect(result.message).toContain('frontend-only environment');
  });

  it('treats missing version endpoint as benign in frontend-only environments', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { checkAppVersion } = await import('../../src/runtime/versionGuard');
    const result = await checkAppVersion();

    expect(result.status).toBe('ok');
    expect(result.message).toContain('frontend-only environment');
  });

  it('reloads on version mismatch outside benchmark mode', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '9.9.9' }),
    });

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        search: '',
        reload: reloadMock,
      },
    });

    const { checkAppVersion } = await import('../../src/runtime/versionGuard');
    const result = await checkAppVersion();

    expect(result.status).toBe('warning');
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('does not reload on version mismatch in benchmark mode', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '9.9.9' }),
    });

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        search: '?bench=1',
        reload: reloadMock,
      },
    });

    const { checkAppVersion } = await import('../../src/runtime/versionGuard');
    const result = await checkAppVersion();

    expect(result.status).toBe('warning');
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
