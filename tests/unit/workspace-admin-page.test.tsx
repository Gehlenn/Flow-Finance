import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceAdminMocks = vi.hoisted(() => ({
  addWorkspaceMember: vi.fn(),
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  listUserWorkspaces: vi.fn(),
  listWorkspaceAuditEvents: vi.fn(),
  listWorkspaceMembers: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  setActiveWorkspaceId: vi.fn(),
  getWorkspaceBillingOverview: vi.fn(),
  listWorkspaceBillingHooks: vi.fn(),
  updateWorkspacePlan: vi.fn(),
}));

vi.mock('../../src/services/workspaceSession', () => ({
  addWorkspaceMember: workspaceAdminMocks.addWorkspaceMember,
  ensureActiveWorkspace: workspaceAdminMocks.ensureActiveWorkspace,
  getCurrentWorkspaceIdentity: workspaceAdminMocks.getCurrentWorkspaceIdentity,
  listUserWorkspaces: workspaceAdminMocks.listUserWorkspaces,
  listWorkspaceAuditEvents: workspaceAdminMocks.listWorkspaceAuditEvents,
  listWorkspaceMembers: workspaceAdminMocks.listWorkspaceMembers,
  removeWorkspaceMember: workspaceAdminMocks.removeWorkspaceMember,
  setActiveWorkspaceId: workspaceAdminMocks.setActiveWorkspaceId,
}));

vi.mock('../../src/services/firestoreBillingStore', () => ({
  getWorkspaceBillingOverview: workspaceAdminMocks.getWorkspaceBillingOverview,
  listWorkspaceBillingHooks: workspaceAdminMocks.listWorkspaceBillingHooks,
  updateWorkspacePlan: workspaceAdminMocks.updateWorkspacePlan,
}));

import WorkspaceAdminPage from '../../pages/WorkspaceAdmin';

function setup(role: 'owner' | 'viewer') {
  workspaceAdminMocks.getCurrentWorkspaceIdentity.mockReturnValue({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });
  workspaceAdminMocks.listUserWorkspaces.mockResolvedValue([{ workspaceId: 'ws-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', name: 'Workspace 1', plan: 'free', role, isDefault: true }]);
  workspaceAdminMocks.ensureActiveWorkspace.mockResolvedValue({ workspaceId: 'ws-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', name: 'Workspace 1', plan: 'free', role, isDefault: true });
  workspaceAdminMocks.getWorkspaceBillingOverview.mockResolvedValue({
    currentPlan: 'free',
    usage: { '2026-04': { transactions: 2, aiQueries: 1, bankConnections: 0 } },
    currentMonthUsage: { transactions: 2, aiQueries: 1, bankConnections: 0 },
    billingState: { workspaceId: 'ws-1', tenantId: 'tenant-1', plan: 'free', status: 'active', updatedAt: '2026-04-02T00:00:00.000Z', updatedByUserId: 'user-1' },
    billingHooks: [],
  });
  workspaceAdminMocks.listWorkspaceBillingHooks.mockResolvedValue([]);
  workspaceAdminMocks.listWorkspaceMembers.mockResolvedValue([{ id: 'ws-1_user-2', tenantId: 'tenant-1', workspaceId: 'ws-1', userId: 'user-2', role: 'member', status: 'active', createdAt: '2026-04-02T00:00:00.000Z', updatedAt: '2026-04-02T00:00:00.000Z' }]);
  workspaceAdminMocks.listWorkspaceAuditEvents.mockResolvedValue([{ id: 'evt-1', tenantId: 'tenant-1', workspaceId: 'ws-1', userId: 'user-1', action: 'workspace.plan_changed', resourceType: 'workspace', resourceId: 'ws-1', createdAt: '2026-04-02T00:00:00.000Z' }]);

  return render(
    <WorkspaceAdminPage
      userId="user-1"
      activeWorkspaceId="ws-1"
      activeWorkspaceName="Workspace 1"
      activeTenantName="Tenant 1"
      activeWorkspaceRole={role}
      onNavigateToTab={vi.fn()}
    />,
  );
}

describe('WorkspaceAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows billing, member and audit sections for owner', async () => {
    setup('owner');

    await waitFor(() => {
      expect(screen.getByText(/Billing and usage/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/Member user id/i)).toBeTruthy();
      expect(screen.getByText(/Audit trail/i)).toBeTruthy();
    });
  });

  it('shows a read-only state for viewer', async () => {
    setup('viewer');

    await waitFor(() => {
      expect(screen.getByText(/Read-only workspace role/i)).toBeTruthy();
    });

    expect(screen.queryByPlaceholderText(/Member user id/i)).toBeNull();
  });
});
