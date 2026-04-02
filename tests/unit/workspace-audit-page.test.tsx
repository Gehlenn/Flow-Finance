import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditMocks = vi.hoisted(() => ({
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  listWorkspaceAuditEvents: vi.fn(),
}));

vi.mock('../../src/services/workspaceSession', () => ({
  ensureActiveWorkspace: auditMocks.ensureActiveWorkspace,
  getCurrentWorkspaceIdentity: auditMocks.getCurrentWorkspaceIdentity,
  listWorkspaceAuditEvents: auditMocks.listWorkspaceAuditEvents,
}));

import WorkspaceAuditPage from '../../pages/WorkspaceAudit';

function setup(role: 'owner' | 'viewer') {
  auditMocks.getCurrentWorkspaceIdentity.mockReturnValue({ userId: 'owner-1', name: 'Owner', email: 'owner@test.dev' });
  auditMocks.ensureActiveWorkspace.mockResolvedValue({
    workspaceId: 'ws-1',
    tenantId: 'tenant-1',
    tenantName: 'Tenant 1',
    name: 'Workspace 1',
    plan: 'pro',
    role,
    isDefault: true,
  });
  auditMocks.listWorkspaceAuditEvents.mockResolvedValue([
    {
      id: 'evt-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'owner-1',
      action: 'workspace.plan_changed',
      resourceType: 'workspace',
      resourceId: 'ws-1',
      metadata: { plan: 'pro' },
      createdAt: '2026-04-02T00:00:00.000Z',
    },
  ]);

  return render(
    <WorkspaceAuditPage
      userId="owner-1"
      activeWorkspaceId="ws-1"
      activeWorkspaceName="Workspace 1"
      activeTenantName="Tenant 1"
      activeWorkspaceRole={role}
      onNavigateToTab={vi.fn()}
    />,
  );
}

describe('WorkspaceAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows filters and audit events for owner', async () => {
    setup('owner');

    await waitFor(() => {
      expect(screen.getByText(/Workspace Audit/i)).toBeTruthy();
      expect(screen.getByText(/workspace.plan_changed/i)).toBeTruthy();
      expect(screen.getByDisplayValue(/Last 30 days/i)).toBeTruthy();
      expect(screen.getByText(/Showing 1 of 1 event/i)).toBeTruthy();
    });
  });

  it('shows a restricted state for viewer', async () => {
    setup('viewer');

    await waitFor(() => {
      expect(screen.getByText(/Admin or owner required/i)).toBeTruthy();
    });

    expect(screen.queryByText(/workspace.plan_changed/i)).toBeNull();
  });
});
