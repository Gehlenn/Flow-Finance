import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsMocks = vi.hoisted(() => ({
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  listUserWorkspaces: vi.fn(),
  setActiveWorkspaceId: vi.fn(),
  getWorkspaceBillingOverview: vi.fn(),
  getWorkspacePlanCatalog: vi.fn(),
  createWorkspaceCheckoutSession: vi.fn(),
  createWorkspacePortalSession: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: function MockGoogleGenAI() {
    return { models: { generateContent: vi.fn() } };
  },
}));

vi.mock('../../services/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  googleProvider: {},
  appleProvider: {},
  linkWithPopup: vi.fn(),
}));

vi.mock('../../src/config/api.config', () => ({
  apiRequest: settingsMocks.apiRequest,
  API_ENDPOINTS: {
    INTEGRATION_KEYS: { ROOT: '/integration-keys', GENERATE: '/integration-keys/generate' },
    AI: { CFO: '/ai/cfo' },
  },
}));

vi.mock('../../src/services/workspaceSession', () => ({
  ensureActiveWorkspace: settingsMocks.ensureActiveWorkspace,
  getCurrentWorkspaceIdentity: settingsMocks.getCurrentWorkspaceIdentity,
  listUserWorkspaces: settingsMocks.listUserWorkspaces,
  setActiveWorkspaceId: settingsMocks.setActiveWorkspaceId,
}));

vi.mock('../../src/services/firestoreBillingStore', () => ({
  getWorkspaceBillingOverview: settingsMocks.getWorkspaceBillingOverview,
}));

vi.mock('../../src/saas/billingClient', () => ({
  getWorkspacePlanCatalog: settingsMocks.getWorkspacePlanCatalog,
  createWorkspaceCheckoutSession: settingsMocks.createWorkspaceCheckoutSession,
  createWorkspacePortalSession: settingsMocks.createWorkspacePortalSession,
}));

import Settings from '../../components/Settings';

function renderSettings(options?: { integrationKeysError?: boolean }) {
  settingsMocks.apiRequest.mockImplementation(async (endpoint: string) => {
    if (String(endpoint).includes('/integration-keys')) {
      if (options?.integrationKeysError) {
        throw new Error('meta down');
      }
      return { configured: false };
    }
    if (String(endpoint).includes('/ai/cfo')) {
      return { answer: '' };
    }
    return {};
  });
  settingsMocks.getCurrentWorkspaceIdentity.mockReturnValue({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });
  settingsMocks.listUserWorkspaces.mockResolvedValue([{ workspaceId: 'ws-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', name: 'Workspace 1', plan: 'free', role: 'owner', isDefault: true }]);
  settingsMocks.ensureActiveWorkspace.mockResolvedValue({ workspaceId: 'ws-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', name: 'Workspace 1', plan: 'free', role: 'owner', isDefault: true });
  settingsMocks.getWorkspaceBillingOverview.mockResolvedValue({
    currentPlan: 'free',
    usage: { '2026-04': { transactions: 0, aiQueries: 0, bankConnections: 0 } },
    currentMonthUsage: { transactions: 0, aiQueries: 0, bankConnections: 0 },
    billingState: { workspaceId: 'ws-1', tenantId: 'tenant-1', plan: 'free', status: 'active', updatedAt: '2026-04-02T00:00:00.000Z', updatedByUserId: 'user-1' },
    billingHooks: [],
  });
  settingsMocks.getWorkspacePlanCatalog.mockResolvedValue({
    scope: 'workspace',
    workspaceId: 'ws-1',
    currentPlan: 'free',
    mockBillingEnabled: true,
    stripeConfigured: false,
    stripePortalEnabled: false,
    hasBillingCustomer: false,
    billingProvider: 'mock',
    manualPlanChangeAllowed: true,
    plans: [],
  });

  return render(
    <Settings
      userName="Flow User"
      userEmail="user@test.dev"
      theme="light"
      activeWorkspaceName="Workspace 1"
      activeTenantName="Tenant 1"
      activeWorkspaceRole="owner"
      onUpdateProfile={vi.fn()}
      onLogout={vi.fn()}
      onThemeChange={vi.fn()}
      onOpenWorkspaceAdmin={vi.fn()}
    />,
  );
}

describe('Settings clipboard diagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('mostra diagnostico visivel quando a copia da chave falha', async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Integracoes/i)).toBeTruthy();
    });

    const writeTextMock = vi.mocked(navigator.clipboard.writeText);
    writeTextMock.mockRejectedValueOnce(new Error('blocked'));

    fireEvent.click(screen.getByRole('button', { name: /copiar payload de integracao/i }));

    const diagnostic = await screen.findByText(/Nao foi possivel copiar o payload de integracao agora/i);
    const statuses = screen.getAllByRole('status');
    expect(statuses.some((node) => node.textContent?.includes(diagnostic.textContent ?? ''))).toBe(true);
    expect(statuses.some((node) => /Proximo passo:/i.test(node.textContent ?? ''))).toBe(true);
  });

  it('mostra diagnostico visivel quando os metadados da chave falham ao carregar', async () => {
    renderSettings({ integrationKeysError: true });

    await screen.findByText(/Nao foi possivel carregar os metadados da chave de integracao agora/i);
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.some((node) => /Proximo passo:/i.test(node.textContent ?? ''))).toBe(true);
  });
});



