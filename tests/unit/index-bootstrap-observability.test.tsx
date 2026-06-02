import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logErrorMock, logInfoMock, logWarnMock } = vi.hoisted(() => ({
  logErrorMock: vi.fn(),
  logInfoMock: vi.fn(),
  logWarnMock: vi.fn(),
}));

const renderMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logError: logErrorMock,
  logInfo: logInfoMock,
  logWarn: logWarnMock,
}));

vi.mock('../../src/runtime/runtimeGuard', () => ({
  initializeRuntimeGuard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/runtime/benchmarkMode', () => ({
  isBenchmarkBrowserSession: vi.fn(() => false),
}));

vi.mock('../../src/ai/queue', () => ({
  aiTaskQueue: {
    initialize: vi.fn(() => {
      throw new Error('queue init failed');
    }),
  },
}));

vi.mock('../../src/events/financialEventPipeline', () => ({
  initializeFinancialEventPipeline: vi.fn(),
}));

vi.mock('../../src/events/listeners/registerListeners', () => ({
  registerEventListeners: vi.fn(),
}));

vi.mock('../../src/debug/aiPanel/AIControlPanel', () => ({
  AIControlPanel: () => <div data-testid="ai-control-panel" />,
}));

vi.mock('../../AppWithAnalytics', () => ({
  default: () => <div data-testid="app-with-analytics" />,
}));

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: renderMock })),
}));

describe('index bootstrap observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('registra falha de bootstrap da fila de IA ao iniciar a aplicacao', async () => {
    await import('../../index');

    expect(logErrorMock).toHaveBeenCalledWith(
      '[App] AI Task Queue initialization failed',
      expect.any(Error),
      expect.objectContaining({
        fallback: 'app-ai-task-queue-initialization-failed',
      }),
    );
  });
});
