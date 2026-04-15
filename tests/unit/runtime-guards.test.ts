import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('runtime guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.resetModules();
    Object.defineProperty(navigator, 'webdriver', {
      configurable: true,
      value: false,
    });
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

  it('skips API probe in local non-production runtime', async () => {
    Object.defineProperty(navigator, 'webdriver', {
      configurable: true,
      value: true,
    });
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:3001');

    const { checkAPIHealth } = await import('../../src/runtime/apiGuard');
    const result = await checkAPIHealth();

    expect(result.status).toBe('ok');
    expect(result.message).toContain('local/non-production runtime');
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('skips version probe in local non-production runtime', async () => {
    Object.defineProperty(navigator, 'webdriver', {
      configurable: true,
      value: true,
    });
    vi.stubEnv('VITE_BACKEND_URL', 'http://127.0.0.1:3001');

    const { checkAppVersion } = await import('../../src/runtime/versionGuard');
    const result = await checkAppVersion();

    expect(result.status).toBe('ok');
    expect(result.message).toContain('local/non-production runtime');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not reload on version mismatch outside benchmark mode (hotfix)', async () => {
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
    expect(reloadMock).not.toHaveBeenCalled();
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
