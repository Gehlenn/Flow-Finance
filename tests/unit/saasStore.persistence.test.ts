import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    delete process.env.SAAS_STORE_FILE;
  });

  it('persists plan, usage and billing hooks across module reloads', async () => {
    const firstInstance = await loadSaasStoreModule();

    firstInstance.setUserPlan('user-1', 'pro');
    firstInstance.incrementMonthlyUsage('user-1', 'transactions', 3);
    firstInstance.appendBillingHook('user-1', {
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

    firstInstance.incrementWorkspaceMonthlyUsage('ws-1', 'aiQueries', 7);
    firstInstance.appendWorkspaceBillingHook('ws-1', {
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

  it('reset removes the persisted store file', async () => {
    const saasStore = await loadSaasStoreModule();

    saasStore.setUserPlan('user-2', 'free');
    expect(fs.existsSync(storeFile)).toBe(true);

    saasStore.resetSaasStoreForTests();

    expect(fs.existsSync(storeFile)).toBe(false);
    expect(saasStore.getUserPlan('user-2')).toBe('free');
  });
});
