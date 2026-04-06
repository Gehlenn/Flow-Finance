import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('eventEngine remote persistence', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    const authSessionStore = await import('../../src/services/authSessionStore');
    authSessionStore.clearEphemeralAccessToken();
    authSessionStore.setEphemeralAccessToken('jwt-token');
  });

  it('mantem cache em memoria e tenta persistir no backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ event: { id: 'evt_1' } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const engine = await import('../../src/events/eventEngine');
    const event = engine.emitFinancialEvent({
      type: 'transaction_created',
      payload: { id: 'tx_1', amount: 100 },
    });

    await Promise.resolve();

    expect(engine.getFinancialEvents()[0].id).toBe(event.id);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/finance/events'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
