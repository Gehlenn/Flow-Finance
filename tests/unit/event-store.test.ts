import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendDomainEvent,
  getDomainEvents,
  resetDomainEventStoreForTests,
} from '../../backend/src/services/finance/eventStore';

describe('eventStore', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDomainEventStoreForTests();
  });

  it('persiste e consulta eventos por workspace em fallback local', async () => {
    vi.stubEnv('POSTGRES_STATE_STORE_ENABLED', 'false');

    await appendDomainEvent({
      workspaceId: 'ws_1',
      tenantId: 'tenant_1',
      userId: 'user_1',
      aggregateId: 'tx_1',
      aggregateType: 'transaction',
      type: 'transaction_created',
      payload: { id: 'tx_1', amount: 100 },
      occurredAt: '2026-04-01T12:00:00.000Z',
    });

    await appendDomainEvent({
      workspaceId: 'ws_2',
      type: 'goal_created',
      occurredAt: '2026-04-01T13:00:00.000Z',
    });

    const events = await getDomainEvents({ workspaceId: 'ws_1' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      workspaceId: 'ws_1',
      aggregateId: 'tx_1',
      type: 'transaction_created',
    });
  });
});
