import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsMocks = vi.hoisted(() => ({
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  listUserWorkspaces: vi.fn(),
  setActiveWorkspaceId: vi.fn(),
  getWorkspaceBillingOverview: vi.fn(),
  apiRequest: vi.fn(),
  logWarn: vi.fn(),
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

vi.mock('../../src/utils/logger', () => ({
  logWarn: settingsMocks.logWarn,
}));

import Settings from '../../components/Settings';
import { linkWithPopup } from '../../services/firebase';

function renderSettings(
  role: 'owner' | 'viewer',
  options?: { integrationKeysConfigured?: boolean; generateError?: boolean; revokeError?: boolean },
) {
  settingsMocks.apiRequest.mockImplementation(async (endpoint: string, init?: { method?: string }) => {
    if (String(endpoint).includes('/integration-keys/generate')) {
      if (options?.generateError) {
        throw new Error('generate failed');
      }
      return {
        configured: true,
        key: 'flw_test_secret',
        keyPrefix: 'flw_test_',
        createdAt: '2026-04-02T00:00:00.000Z',
        warning: '',
      };
    }
    if (String(endpoint) === '/integration-keys' && init?.method === 'DELETE') {
      if (options?.revokeError) {
        throw new Error('revoke failed');
      }
      return { configured: false };
    }
    if (String(endpoint) === '/integration-keys') {
      return options?.integrationKeysConfigured
        ? { configured: true, keyPrefix: 'flw_test_', createdAt: '2026-04-02T00:00:00.000Z' }
        : { configured: false };
    }
    if (String(endpoint).includes('/ai/cfo')) {
      return { answer: '' };
    }
    return {};
  });
  settingsMocks.getCurrentWorkspaceIdentity.mockReturnValue({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });
  settingsMocks.listUserWorkspaces.mockResolvedValue([{ workspaceId: 'ws-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', name: 'Workspace 1', plan: 'free', role, isDefault: true }]);
  settingsMocks.ensureActiveWorkspace.mockResolvedValue({ workspaceId: 'ws-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', name: 'Workspace 1', plan: 'free', role, isDefault: true });
  settingsMocks.getWorkspaceBillingOverview.mockResolvedValue({
    currentPlan: 'free',
    usage: { '2026-04': { transactions: 0, aiQueries: 0, bankConnections: 0 } },
    currentMonthUsage: { transactions: 0, aiQueries: 0, bankConnections: 0 },
    billingState: { workspaceId: 'ws-1', tenantId: 'tenant-1', plan: 'free', status: 'active', updatedAt: '2026-04-02T00:00:00.000Z', updatedByUserId: 'user-1' },
    billingHooks: [],
  });

  return render(
    <Settings
      userName="Flow User"
      userEmail="user@test.dev"
      theme="light"
      activeWorkspaceName="Workspace 1"
      activeTenantName="Tenant 1"
      activeWorkspaceRole={role}
      onUpdateProfile={vi.fn()}
      onLogout={vi.fn()}
      onThemeChange={vi.fn()}
      onOpenWorkspaceAdmin={vi.fn()}
    />,
  );
}

describe('Settings workspace admin entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the workspace admin entry for owner', async () => {
    renderSettings('owner');

    await waitFor(() => {
      expect(screen.getByText(/Abrir admin do workspace/i)).toBeTruthy();
    });
  });

  it('hides the workspace admin entry for viewer', async () => {
    renderSettings('viewer');

    await waitFor(() => {
      expect(screen.getByText(/Operacao do workspace/i)).toBeTruthy();
    });

    expect(screen.queryByText(/Abrir admin do workspace/i)).toBeNull();
  });

  it('renders PT-BR microcopy for key settings labels', async () => {
    renderSettings('owner');

    await waitFor(() => {
      expect(screen.getByText(/Operacao do workspace/i)).toBeTruthy();
    });

    expect(screen.getByText('Sair', { exact: false })).toBeTruthy();
    expect(screen.getAllByText(/Suporte operacional/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tema/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Admin do workspace/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Vincular Google/i)).toBeTruthy();
    expect(screen.getByText(/Vincular Apple/i)).toBeTruthy();
  });

  it('mostra diagnostico explicito quando o suporte IA cai em fallback', async () => {
    renderSettings('owner');

    await waitFor(() => {
      expect(screen.getByText(/Operacao do workspace/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Guia com IA/i }));
    fireEvent.change(screen.getByPlaceholderText(/caixa, integrações ou planos/i), { target: { value: 'O que ainda falta entrar?' } });
    fireEvent.keyPress(screen.getByPlaceholderText(/caixa, integrações ou planos/i), { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico do guia com IA/i)).toBeTruthy();
    });
    expect(screen.getByText(/Suporte IA indisponivel para consolidar recebiveis agora/i)).toBeTruthy();
    expect(screen.getByText(/Revise a tela de contas a receber e confirme os vencimentos/i)).toBeTruthy();
  });

  it('mostra diagnostico visivel quando o plano do workspace nao carrega', async () => {
    settingsMocks.ensureActiveWorkspace.mockRejectedValueOnce(new Error('network error'));

    renderSettings('owner');

    expect(await screen.findByText(/Nao foi possivel carregar o plano do workspace/i)).toBeTruthy();
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Falha ao carregar a configuracao/i)).toBeTruthy();
    expect(screen.getByText(/Pr[óo]ximo passo:/i)).toBeTruthy();
    expect(settingsMocks.logWarn).toHaveBeenCalledWith(
      '[Settings] Failed to load workspace billing overview',
      expect.objectContaining({
        fallback: 'settings-billing-overview-load-failed',
      }),
    );
  });

  it('mostra diagnostico visivel quando o link social falha', async () => {
    vi.mocked(linkWithPopup).mockRejectedValueOnce({ code: 'auth/credential-already-in-use' });

    renderSettings('owner');

    await waitFor(() => {
      expect(screen.getByText(/Vincular Google/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Vincular Google/i }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Credencial ja vinculada/i)).toBeTruthy();
    expect(screen.getByText(/ja esta associada a outra conta/i)).toBeTruthy();
    expect(screen.getByText(/Use outra conta social ou revise qual usuario Firebase esta ativo/i)).toBeTruthy();
    expect(settingsMocks.logWarn).toHaveBeenCalledWith(
      '[Settings] Failed to link social account',
      expect.objectContaining({
        fallback: 'settings-link-social-account-failed',
      }),
    );
  });

  it('registra diagnostico quando a geração da chave de integracao falha', async () => {
    renderSettings('owner', { generateError: true });

    await waitFor(() => {
      expect(screen.getByText(/Chave de integração/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Gerar chave/i }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Nao foi possivel gerar a chave/i)).toBeTruthy();
    expect(settingsMocks.logWarn).toHaveBeenCalledWith(
      '[Settings] Failed to generate integration key',
      expect.objectContaining({
        fallback: 'settings-generate-integration-key-failed',
      }),
    );
  });

  it('registra diagnostico quando a revogacao da chave de integracao falha', async () => {
    renderSettings('owner', { integrationKeysConfigured: true, revokeError: true });

    await waitFor(() => {
      expect(screen.getByText(/Rotacionar/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Revogar chave/i }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Nao foi possivel revogar a chave/i)).toBeTruthy();
    expect(settingsMocks.logWarn).toHaveBeenCalledWith(
      '[Settings] Failed to revoke integration key',
      expect.objectContaining({
        fallback: 'settings-revoke-integration-key-failed',
      }),
    );
  });

});
