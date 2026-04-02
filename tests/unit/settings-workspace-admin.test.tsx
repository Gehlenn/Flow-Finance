import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsMocks = vi.hoisted(() => ({
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  listUserWorkspaces: vi.fn(),
  setActiveWorkspaceId: vi.fn(),
  getWorkspaceBillingOverview: vi.fn(),
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

vi.mock('../../src/services/workspaceSession', () => ({
  ensureActiveWorkspace: settingsMocks.ensureActiveWorkspace,
  getCurrentWorkspaceIdentity: settingsMocks.getCurrentWorkspaceIdentity,
  listUserWorkspaces: settingsMocks.listUserWorkspaces,
  setActiveWorkspaceId: settingsMocks.setActiveWorkspaceId,
}));

vi.mock('../../src/services/firestoreBillingStore', () => ({
  getWorkspaceBillingOverview: settingsMocks.getWorkspaceBillingOverview,
}));

import Settings from '../../components/Settings';

function renderSettings(role: 'owner' | 'viewer') {
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
      expect(screen.getByText(/Open workspace admin/i)).toBeTruthy();
    });
  });

  it('hides the workspace admin entry for viewer', async () => {
    renderSettings('viewer');

    await waitFor(() => {
      expect(screen.getByText(/Plan:/i)).toBeTruthy();
    });

    expect(screen.queryByText(/Open workspace admin/i)).toBeNull();
  });
});
