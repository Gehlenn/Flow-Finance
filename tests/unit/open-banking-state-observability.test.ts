import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { logWarnMock } = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: logWarnMock,
}));

vi.mock('../../src/utils/workspaceStorage', () => ({
  getActiveWorkspaceScopedStorageKey: vi.fn(() => 'workspace:flow_bank_connections'),
}));

describe('openBankingState observability', () => {
  beforeEach(() => {
    vi.resetModules();
    logWarnMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('registra aviso quando o cache local de conexoes nao decodifica', async () => {
    localStorage.setItem('workspace:flow_bank_connections', '{broken');
    const { readConnections } = await import('../../services/integrations/openBankingState');

    expect(readConnections()).toEqual([]);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[OpenBanking] Failed to parse local connections cache',
      expect.any(SyntaxError),
      expect.objectContaining({
        fallback: 'open-banking-parse-local-connections-cache-failed',
      }),
    );
  });
});
