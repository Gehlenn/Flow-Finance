import { afterEach, describe, expect, it } from 'vitest';
import { loadWorkspaceEntities } from '../../src/services/firestoreWorkspaceStore';

describe('firestoreWorkspaceStore e2e seed fallback', () => {
  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('flow_e2e_auth');
      localStorage.removeItem('flow_e2e_user_id');
      localStorage.removeItem('flow_e2e_seed_entities');
      localStorage.removeItem('flow_e2e_seed_entities:ws-e2e-seeded');
    }

    const globalAny = globalThis as Record<string, unknown>;
    delete globalAny.__FLOW_E2E_AUTH__;
    delete globalAny.__FLOW_E2E_USER_ID__;
    delete globalAny.__FLOW_E2E_SEED_ENTITIES__;
  });

  it('returns default deterministic transaction when e2e auth is active', async () => {
    const globalAny = globalThis as Record<string, unknown>;
    globalAny.__FLOW_E2E_AUTH__ = true;
    globalAny.__FLOW_E2E_USER_ID__ = 'seed-user';

    const entities = await loadWorkspaceEntities('ws-e2e-default');

    expect(entities.transactions.length).toBeGreaterThan(0);
    expect(entities.transactions[0]?.description).toBe('Restaurante');
    expect(entities.transactions[0]?.workspace_id).toBe('ws-e2e-default');
  });

  it('uses explicit seeded entities from global seed map when provided', async () => {
    const globalAny = globalThis as Record<string, unknown>;
    globalAny.__FLOW_E2E_AUTH__ = true;
    globalAny.__FLOW_E2E_SEED_ENTITIES__ = {
      'ws-e2e-seeded': {
        accounts: [],
        transactions: [
          {
            id: 'tx-seeded-1',
            amount: 99,
            type: 'Despesa',
            category: 'Pessoal',
            description: 'Seed custom',
            date: '2026-05-13T10:00:00.000Z',
            workspace_id: 'ws-e2e-seeded',
          },
        ],
        goals: [],
        reminders: [],
      },
    };

    const entities = await loadWorkspaceEntities('ws-e2e-seeded');

    expect(entities.transactions).toHaveLength(1);
    expect(entities.transactions[0]?.description).toBe('Seed custom');
    expect(entities.transactions[0]?.id).toBe('tx-seeded-1');
  });
});
