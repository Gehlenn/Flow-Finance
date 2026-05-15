import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();
const logErrorMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('../../src/utils/logger', () => ({
  logInfo: (...args: unknown[]) => logInfoMock(...args),
  logWarn: (...args: unknown[]) => logWarnMock(...args),
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

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

  it('registra aviso quando a URL base do API e invalida', async () => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false }); vi.stubEnv('VITE_BACKEND_URL', 'nota-url-valida'); fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const { checkAPIHealth } = await import('../../src/runtime/apiGuard');
    const result = await checkAPIHealth();

    expect(result.status).toBe('ok');
    expect(result.message).toContain('frontend-only environment');
    expect(logWarnMock).not.toHaveBeenCalled();
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

  it('registra aviso quando a URL base da versao e invalida', async () => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false }); vi.stubEnv('VITE_BACKEND_URL', 'nota-url-valida'); fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const { checkAppVersion } = await import('../../src/runtime/versionGuard');
    const result = await checkAppVersion();

    expect(result.status).toBe('ok');
    expect(result.message).toContain('frontend-only environment');
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it('registra contexto quando o chunk guard detecta falha de chunk', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadMock,
      },
    });
    vi.stubEnv('PROD', 'false');

    const { protectChunkLoading } = await import('../../src/runtime/chunkGuard');
    const result = protectChunkLoading();

    expect(result.status).toBe('ok');

    const errorEvent = new Event('error') as ErrorEvent;
    Object.defineProperty(errorEvent, 'message', {
      configurable: true,
      value: 'Failed to fetch dynamically imported module',
    });
    Object.defineProperty(errorEvent, 'error', {
      configurable: true,
      value: new Error('chunk missing'),
    });
    window.dispatchEvent(errorEvent);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('registra contexto quando o service worker validation falha', async () => {
    const cachesKeysMock = vi.fn().mockRejectedValueOnce(new Error('cache backend offline'));
    const serviceWorkerMock = {
      getRegistrations: vi.fn(),
    };
    vi.stubGlobal('caches', {
      keys: cachesKeysMock,
      delete: vi.fn(),
    } as unknown as CacheStorage);
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: serviceWorkerMock,
    } as Navigator & { serviceWorker: ServiceWorkerContainer });

    const { validateServiceWorker } = await import('../../src/runtime/serviceWorkerGuard');
    const result = await validateServiceWorker();

    expect(result.status).toBe('error');
    expect(logErrorMock).toHaveBeenCalledWith(
      '[SW Guard] Validation failed',
      expect.any(Error),
      expect.objectContaining({
        expectedCacheVersion: 'flow-finance-v3',
        fallback: 'service-worker-validation-failed',
      }),
    );
  });
});








