import { beforeEach, describe, expect, it, vi } from 'vitest';

const protectChunkLoadingMock = vi.fn(() => ({ guard: 'chunk', status: 'ok', message: 'chunk ok' }));
const validateServiceWorkerMock = vi.fn().mockResolvedValue({ guard: 'sw', status: 'critical', message: 'sw down' });
const checkAPIHealthMock = vi.fn().mockResolvedValue({ guard: 'api', status: 'ok', message: 'api ok' });
const checkAppVersionMock = vi.fn().mockResolvedValue({ guard: 'version', status: 'error', message: 'version mismatch' });
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock('../../src/runtime/chunkGuard', () => ({
  protectChunkLoading: () => protectChunkLoadingMock(),
}));

vi.mock('../../src/runtime/serviceWorkerGuard', () => ({
  validateServiceWorker: () => validateServiceWorkerMock(),
}));

vi.mock('../../src/runtime/apiGuard', () => ({
  checkAPIHealth: () => checkAPIHealthMock(),
}));

vi.mock('../../src/runtime/versionGuard', () => ({
  checkAppVersion: () => checkAppVersionMock(),
}));

vi.mock('../../src/utils/logger', () => ({
  logInfo: (...args: unknown[]) => logInfoMock(...args),
  logWarn: (...args: unknown[]) => logWarnMock(...args),
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

describe('runtimeGuard observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('logs bootstrap and critical issues with context', async () => {
    const { initializeRuntimeGuard, getGuardStatus } = await import('../../src/runtime/runtimeGuard');

    await initializeRuntimeGuard({
      apiHealthCheckInterval: 0,
      versionCheckInterval: 0,
      enableChunkRetry: true,
      enableAutoReload: true,
    });

    expect(logInfoMock).toHaveBeenCalledWith(
      '[Runtime Guard] Initializing protection systems...',
      expect.objectContaining({ fallback: 'runtime-guard-initializing' }),
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      '[Runtime Guard] Initialization complete',
      expect.objectContaining({
        fallback: 'runtime-guard-initialization-complete',
        results: expect.any(Array),
      }),
    );
    expect(logErrorMock).toHaveBeenCalledWith(
      '[Runtime Guard] Critical issues detected',
      expect.any(Error),
      expect.objectContaining({
        fallback: 'runtime-guard-critical-issues-detected',
        criticalIssues: expect.any(Array),
      }),
    );
    expect(document.getElementById('runtime-guard-critical-error')).toBeTruthy();
    expect(getGuardStatus().initialized).toBe(true);

    await initializeRuntimeGuard({
      apiHealthCheckInterval: 0,
      versionCheckInterval: 0,
      enableChunkRetry: false,
      enableAutoReload: false,
    });

    expect(logWarnMock).toHaveBeenCalledWith(
      '[Runtime Guard] Already initialized',
      expect.objectContaining({ fallback: 'runtime-guard-already-initialized' }),
    );
  });
});
