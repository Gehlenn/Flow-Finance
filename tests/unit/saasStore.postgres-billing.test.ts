/**
 * Testes de integração: path de billing no Postgres
 *
 * Verifica que as funções de escrita do saasStore:
 * - chamam saveWorkspaceSaasState com o payload correto
 * - propagam erros do Postgres para o caller
 * - absorvem falhas do saveJsonState (fire-and-forget, logger.warn)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postgresMocks = vi.hoisted(() => ({
  saveWorkspaceSaasState: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceSaasState: vi.fn().mockResolvedValue(null),
  saveJsonState: vi.fn().mockResolvedValue(undefined),
  loadJsonState: vi.fn().mockResolvedValue(null),
  insertAuditEvent: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceStoreState: vi.fn().mockResolvedValue(null),
  saveWorkspaceStoreState: vi.fn().mockResolvedValue(undefined),
}));

const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../backend/src/services/persistence/postgresStateStore', () => postgresMocks);
vi.mock('../../backend/src/config/logger', () => ({ default: loggerMock }));

async function loadSaasStoreModule() {
  vi.resetModules();
  return import('../../backend/src/utils/saasStore');
}

describe('saasStore — Postgres como fonte de verdade do billing', () => {
  beforeEach(() => {
    postgresMocks.saveWorkspaceSaasState.mockReset().mockResolvedValue(undefined);
    postgresMocks.loadWorkspaceSaasState.mockReset().mockResolvedValue(null);
    postgresMocks.saveJsonState.mockReset().mockResolvedValue(undefined);
    postgresMocks.loadJsonState.mockReset().mockResolvedValue(null);
    loggerMock.warn.mockReset();
    // Desabilitar file-based storage para isolar o path Postgres
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
  });

  it('incrementWorkspaceMonthlyUsage chama saveWorkspaceSaasState com uso atualizado', async () => {
    const saasStore = await loadSaasStoreModule();
    saasStore.resetSaasStoreForTests();

    await saasStore.incrementWorkspaceMonthlyUsage('ws-pg-1', 'transactions', 5);

    expect(postgresMocks.saveWorkspaceSaasState).toHaveBeenCalledOnce();
    const payload = postgresMocks.saveWorkspaceSaasState.mock.calls[0][0];
    const monthKey = Object.keys(payload.usageByWorkspace['ws-pg-1'])[0];
    expect(payload.usageByWorkspace['ws-pg-1'][monthKey].transactions).toBe(5);
  });

  it('incrementos consecutivos acumulam e persistem corretamente', async () => {
    const saasStore = await loadSaasStoreModule();
    saasStore.resetSaasStoreForTests();

    await saasStore.incrementWorkspaceMonthlyUsage('ws-pg-2', 'aiQueries', 3);
    await saasStore.incrementWorkspaceMonthlyUsage('ws-pg-2', 'aiQueries', 4);

    expect(postgresMocks.saveWorkspaceSaasState).toHaveBeenCalledTimes(2);
    const lastPayload = postgresMocks.saveWorkspaceSaasState.mock.calls[1][0];
    const monthKey = Object.keys(lastPayload.usageByWorkspace['ws-pg-2'])[0];
    expect(lastPayload.usageByWorkspace['ws-pg-2'][monthKey].aiQueries).toBe(7);
  });

  it('appendWorkspaceBillingHook persiste hook com shape correto no Postgres', async () => {
    const saasStore = await loadSaasStoreModule();
    saasStore.resetSaasStoreForTests();

    await saasStore.appendWorkspaceBillingHook('ws-pg-3', {
      workspaceId: 'ws-pg-3',
      userId: 'user-owner',
      plan: 'pro',
      event: 'plan_changed',
      amount: 0,
      at: '2026-05-01T10:00:00.000Z',
    });

    expect(postgresMocks.saveWorkspaceSaasState).toHaveBeenCalledOnce();
    const payload = postgresMocks.saveWorkspaceSaasState.mock.calls[0][0];
    const hooks = payload.billingHooksByWorkspace['ws-pg-3'];
    expect(hooks).toHaveLength(1);
    expect(hooks[0]).toMatchObject({
      workspaceId: 'ws-pg-3',
      userId: 'user-owner',
      plan: 'pro',
      event: 'plan_changed',
    });
    expect(typeof hooks[0].id).toBe('string');
    expect(hooks[0].id.length).toBeGreaterThan(0);
  });

  it('erro no Postgres propaga a partir de incrementWorkspaceMonthlyUsage', async () => {
    postgresMocks.saveWorkspaceSaasState.mockRejectedValue(new Error('DB write failed'));

    const saasStore = await loadSaasStoreModule();
    saasStore.resetSaasStoreForTests();

    await expect(
      saasStore.incrementWorkspaceMonthlyUsage('ws-pg-err', 'transactions', 1),
    ).rejects.toThrow('DB write failed');
  });

  it('erro no Postgres propaga a partir de appendWorkspaceBillingHook', async () => {
    postgresMocks.saveWorkspaceSaasState.mockRejectedValue(new Error('connection timeout'));

    const saasStore = await loadSaasStoreModule();
    saasStore.resetSaasStoreForTests();

    await expect(
      saasStore.appendWorkspaceBillingHook('ws-pg-err2', {
        workspaceId: 'ws-pg-err2',
        userId: 'u-1',
        plan: 'free',
        event: 'limit_reached',
        amount: 1,
        at: '2026-05-01T10:00:00.000Z',
      }),
    ).rejects.toThrow('connection timeout');
  });

  it('falha no saveJsonState nao propaga — registrado como warn', async () => {
    // saveWorkspaceSaasState resolve, mas saveJsonState falha (fire-and-forget)
    postgresMocks.saveJsonState.mockRejectedValue(new Error('blob write failed'));
    // Habilitar legacy blobs para este teste
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'false';

    const saasStore = await loadSaasStoreModule();
    saasStore.resetSaasStoreForTests();

    // Não deve lançar
    await expect(
      saasStore.incrementWorkspaceMonthlyUsage('ws-pg-4', 'bankConnections', 1),
    ).resolves.toBeTypeOf('number');

    // Aguarda a Promise fire-and-forget resolver (microtask)
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loggerMock.warn).toHaveBeenCalledOnce();
    const [ctx] = loggerMock.warn.mock.calls[0];
    expect(ctx).toMatchObject({ error: expect.objectContaining({ message: 'blob write failed' }) });
  });

  it('resetWorkspaceUsage persiste estado limpo no Postgres', async () => {
    const saasStore = await loadSaasStoreModule();
    saasStore.resetSaasStoreForTests();

    await saasStore.incrementWorkspaceMonthlyUsage('ws-pg-5', 'transactions', 10);
    postgresMocks.saveWorkspaceSaasState.mockClear();

    await saasStore.resetWorkspaceUsage('ws-pg-5');

    expect(postgresMocks.saveWorkspaceSaasState).toHaveBeenCalledOnce();
    const payload = postgresMocks.saveWorkspaceSaasState.mock.calls[0][0];
    expect(payload.usageByWorkspace['ws-pg-5']).toBeUndefined();
  });
});
