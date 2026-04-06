/**
 * Testes para src/services/localSyncService.ts
 *
 * Cobre:
 *  - pushToCloud: chama a API com o payload correto e tolera falhas silenciosamente
 *  - pullFromCloud: retorna dados estruturados da API
 *  - hydrateGoalsFromCloud: mescla corretamente cloud → localStorage (upsert + tombstone)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks de módulos ─────────────────────────────────────────────────────────

const apiRequestMock = vi.fn();

vi.mock('../../src/config/api.config', () => ({
  API_ENDPOINTS: {
    SYNC: {
      PUSH: 'http://localhost:3001/api/sync/push',
      PULL: 'http://localhost:3001/api/sync/pull',
    },
  },
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

// ─── Importações após mock ────────────────────────────────────────────────────

import {
  hydrateGoalsFromCloud,
  pullFromCloud,
  pushToCloud,
} from '../../src/services/localSyncService';

// ─── localStorage fake ────────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  });
  apiRequestMock.mockReset();
});

// ─── pushToCloud ──────────────────────────────────────────────────────────────

describe('pushToCloud', () => {
  it('chama apiRequest com entity e items corretos', async () => {
    apiRequestMock.mockResolvedValueOnce({ success: true, upserted: 1, deleted: 0 });

    await pushToCloud('goals', [{ id: 'g1', updatedAt: '2026-01-01T00:00:00.000Z' }]);

    expect(apiRequestMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sync/push',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          entity: 'goals',
          items: [{ id: 'g1', updatedAt: '2026-01-01T00:00:00.000Z' }],
        }),
        credentials: 'include',
        silent: true,
      }),
    );
  });

  it('nao lanca excecao quando a API falha', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      pushToCloud('goals', [{ id: 'g1', updatedAt: '2026-01-01T00:00:00.000Z' }]),
    ).resolves.toBeUndefined();
  });

  it('nao chama a API quando lista de items esta vazia', async () => {
    await pushToCloud('goals', []);
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});

// ─── pullFromCloud ────────────────────────────────────────────────────────────

describe('pullFromCloud', () => {
  it('retorna dados da API quando bem-sucedido', async () => {
    const fakeResult = {
      since: null,
      serverTime: '2026-04-06T00:00:00.000Z',
      entities: { goals: [], accounts: [], transactions: [], subscriptions: [] },
    };
    apiRequestMock.mockResolvedValueOnce(fakeResult);

    const result = await pullFromCloud();

    expect(result).toEqual(fakeResult);
    expect(apiRequestMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sync/pull',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('retorna null quando a API falha', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('timeout'));

    const result = await pullFromCloud();
    expect(result).toBeNull();
  });

  it('inclui parametro since na query string quando fornecido', async () => {
    apiRequestMock.mockResolvedValueOnce({
      since: '2026-01-01T00:00:00.000Z',
      serverTime: '2026-04-06T00:00:00.000Z',
      entities: { goals: [], accounts: [], transactions: [], subscriptions: [] },
    });

    await pullFromCloud('2026-01-01T00:00:00.000Z');

    expect(apiRequestMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sync/pull?since=2026-01-01T00%3A00%3A00.000Z',
      expect.any(Object),
    );
  });
});

// ─── hydrateGoalsFromCloud ────────────────────────────────────────────────────

describe('hydrateGoalsFromCloud', () => {
  const serverTime = '2026-04-06T10:00:00.000Z';

  const makePullResult = (goals: unknown[]) => ({
    since: null,
    serverTime,
    entities: {
      goals,
      accounts: [],
      transactions: [],
      subscriptions: [],
    },
  });

  it('nao altera o localStorage se a nuvem retornar goals vazio', async () => {
    store['flow_financial_goals'] = JSON.stringify([{ id: 'local1', name: 'Local goal' }]);
    apiRequestMock.mockResolvedValueOnce(makePullResult([]));

    const updated = await hydrateGoalsFromCloud();

    expect(updated).toBe(false);
    const local = JSON.parse(store['flow_financial_goals']);
    expect(local).toHaveLength(1);
    expect(local[0].id).toBe('local1');
  });

  it('upserta goals da nuvem no localStorage preservando itens locais exclusivos', async () => {
    store['flow_financial_goals'] = JSON.stringify([
      { id: 'local-only', name: 'Apenas local', user_id: 'u1' },
      { id: 'shared', name: 'Versao local', user_id: 'u1' },
    ]);

    apiRequestMock.mockResolvedValueOnce(
      makePullResult([
        {
          id: 'shared',
          updatedAt: serverTime,
          payload: { id: 'shared', name: 'Versao nuvem', user_id: 'u1' },
        },
        {
          id: 'cloud-only',
          updatedAt: serverTime,
          payload: { id: 'cloud-only', name: 'So na nuvem', user_id: 'u1' },
        },
      ]),
    );

    const updated = await hydrateGoalsFromCloud();
    expect(updated).toBe(true);

    const local: Array<{ id: string; name: string }> = JSON.parse(store['flow_financial_goals']);
    const byId = Object.fromEntries(local.map((g) => [g.id, g]));

    expect(byId['local-only'].name).toBe('Apenas local');          // local preservado
    expect(byId['shared'].name).toBe('Versao nuvem');              // cloud venceu
    expect(byId['cloud-only'].name).toBe('So na nuvem');           // cloud adicionado
  });

  it('remove item do localStorage quando cloud envia tombstone deleted:true', async () => {
    store['flow_financial_goals'] = JSON.stringify([
      { id: 'to-delete', name: 'Vai ser removido' },
      { id: 'keep', name: 'Fica' },
    ]);

    apiRequestMock.mockResolvedValueOnce(
      makePullResult([{ id: 'to-delete', updatedAt: serverTime, deleted: true }]),
    );

    await hydrateGoalsFromCloud();

    const local: Array<{ id: string }> = JSON.parse(store['flow_financial_goals']);
    expect(local.map((g) => g.id)).not.toContain('to-delete');
    expect(local.map((g) => g.id)).toContain('keep');
  });

  it('salva o serverTime como marcador de ultima sincronizacao', async () => {
    apiRequestMock.mockResolvedValueOnce(
      makePullResult([
        { id: 'g1', updatedAt: serverTime, payload: { id: 'g1', name: 'Meta nova' } },
      ]),
    );

    await hydrateGoalsFromCloud();

    expect(store['flow_financial_goals_last_pull']).toBe(serverTime);
  });

  it('retorna false quando a API falha', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('connection refused'));

    const updated = await hydrateGoalsFromCloud();
    expect(updated).toBe(false);
  });
});
