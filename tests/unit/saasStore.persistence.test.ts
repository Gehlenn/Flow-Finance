import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postgresMocks = vi.hoisted(() => ({
  saveWorkspaceSaasState: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceSaasState: vi.fn().mockResolvedValue(null),
  saveJsonState: vi.fn().mockResolvedValue(undefined),
  loadJsonState: vi.fn().mockResolvedValue(null),
  insertAuditEvent: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceStoreState: vi.fn().mockResolvedValue(null),
  saveWorkspaceStoreState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../backend/src/services/persistence/postgresStateStore', () => postgresMocks);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-finance-saas-store-'));
const storeFile = path.join(tempDir, 'saas-store.json');

async function loadSaasStoreModule() {
  vi.resetModules();
  return import('../../backend/src/utils/saasStore');
}

describe('saasStore persistence', () => {
  beforeEach(async () => {
    process.env.SAAS_STORE_FILE = storeFile;
    if (fs.existsSync(storeFile)) {
      fs.rmSync(storeFile, { force: true });
    }

    const saasStore = await loadSaasStoreModule();
    saasStore.resetSaasStoreForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SAAS_STORE_FILE;
  });

  it('persists plan, usage and billing hooks across module reloads', async () => {
    const firstInstance = await loadSaasStoreModule();

    await firstInstance.setUserPlan('user-1', 'pro');
    await firstInstance.incrementMonthlyUsage('user-1', 'transactions', 3);
    await firstInstance.appendBillingHook('user-1', {
      userId: 'user-1',
      plan: 'pro',
      event: 'usage_recorded',
      resource: 'transactions',
      amount: 3,
      at: '2026-03-31T12:00:00.000Z',
    });

    const secondInstance = await loadSaasStoreModule();

    expect(secondInstance.getUserPlan('user-1')).toBe('pro');
    expect(secondInstance.getMonthlyCount('user-1', 'transactions')).toBe(3);
    expect(secondInstance.getBillingHookCount('user-1')).toBe(1);
  });

  it('persists workspace usage and workspace billing hooks across module reloads', async () => {
    const firstInstance = await loadSaasStoreModule();

    await firstInstance.incrementWorkspaceMonthlyUsage('ws-1', 'aiQueries', 7);
    await firstInstance.appendWorkspaceBillingHook('ws-1', {
      workspaceId: 'ws-1',
      userId: 'user-owner',
      plan: 'pro',
      event: 'usage_recorded',
      resource: 'aiQueries',
      amount: 7,
      at: '2026-03-31T12:00:00.000Z',
    });

    const secondInstance = await loadSaasStoreModule();

    expect(secondInstance.getWorkspaceMonthlyCount('ws-1', 'aiQueries')).toBe(7);
    expect(secondInstance.getWorkspaceBillingHookCount('ws-1')).toBe(1);
  });

  it('keeps confirmed usage when the legacy file backup fails', async () => {
    const saasStore = await loadSaasStoreModule();
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw new Error('legacy file unavailable');
    });

    await expect(
      saasStore.incrementMonthlyUsage('user-file-backup-failure', 'aiQueries', 1),
    ).resolves.toBe(1);

    expect(saasStore.getMonthlyCount('user-file-backup-failure', 'aiQueries')).toBe(1);
    writeSpy.mockRestore();
  });

  it('reset removes the persisted store file', async () => {
    const saasStore = await loadSaasStoreModule();

    await saasStore.setUserPlan('user-2', 'free');
    expect(fs.existsSync(storeFile)).toBe(true);

    saasStore.resetSaasStoreForTests();

    expect(fs.existsSync(storeFile)).toBe(false);
    expect(saasStore.getUserPlan('user-2')).toBe('free');
  });
});
