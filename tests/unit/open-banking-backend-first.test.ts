import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectBank, reloadConnections } from '../../services/integrations/openBankingService';

describe('openBankingService backend-first mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '');
    vi.stubEnv('VITE_ENABLE_LOCAL_BANKING_FALLBACK', 'false');
  });

  it('does not return local connections when backend banking is disabled and fallback is off', async () => {
    localStorage.setItem('flow_bank_connections:global', JSON.stringify([
      {
        id: 'conn_local_only',
        user_id: 'u1',
        bank_name: 'Banco Local',
        provider: 'mock',
        connection_status: 'connected',
        created_at: new Date().toISOString(),
      },
    ]));

    await expect(reloadConnections('u1')).resolves.toEqual([]);
  });

  it('throws instead of creating a mock connection when backend banking is disabled and fallback is off', async () => {
    await expect(connectBank('nubank', 'u1')).rejects.toThrow(/backend indisponivel/i);
  });
});
