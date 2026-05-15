import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditMocks = vi.hoisted(() => ({
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  listWorkspaceAuditEventsPage: vi.fn(),
}));

const workspaceAuditLoggerMock = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/services/workspaceSession', () => ({
  ensureActiveWorkspace: auditMocks.ensureActiveWorkspace,
  getCurrentWorkspaceIdentity: auditMocks.getCurrentWorkspaceIdentity,
  listWorkspaceAuditEventsPage: auditMocks.listWorkspaceAuditEventsPage,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: workspaceAuditLoggerMock.logWarn,
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
  auditMocks.listWorkspaceAuditEventsPage.mockResolvedValue({
    events: [
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
    ],
    nextCursor: null,
  });

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
    workspaceAuditLoggerMock.logWarn.mockReset();
  });

  it('shows filters and audit events for owner', async () => {
    setup('owner');

    await waitFor(() => {
      expect(screen.getByText(/Auditoria do workspace/i)).toBeTruthy();
      expect(screen.getByText(/workspace.plan_changed/i)).toBeTruthy();
      expect(screen.getByDisplayValue(/Últimos 30 dias/i)).toBeTruthy();
      expect(screen.getByText(/Mostrando 1 evento\(s\) carregado\(s\)/i)).toBeTruthy();
    });
  });

  it('shows a restricted state for viewer', async () => {
    setup('viewer');

    await waitFor(() => {
      expect(screen.getByText(/Owner ou admin necessários/i)).toBeTruthy();
    });

    expect(screen.queryByText(/workspace.plan_changed/i)).toBeNull();
  });

  it('shows a visible diagnostic when audit events fail to load', async () => {
    auditMocks.ensureActiveWorkspace.mockRejectedValueOnce(new Error('network offline'));

    render(
      <WorkspaceAuditPage
        userId="owner-1"
        activeWorkspaceId="ws-1"
        activeWorkspaceName="Workspace 1"
        activeTenantName="Tenant 1"
        activeWorkspaceRole="owner"
        onNavigateToTab={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Nao foi possivel carregar os eventos de auditoria deste workspace/i)).toBeTruthy();
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Falha ao carregar a auditoria/i)).toBeTruthy();
    expect(screen.getByText(/Pr[óo]ximo passo:/i)).toBeTruthy();
    expect(workspaceAuditLoggerMock.logWarn).toHaveBeenCalledWith(
      '[WorkspaceAudit] Failed to load audit events',
      expect.objectContaining({
        fallback: 'workspace-audit-load-failed',
      }),
    );
  });
});
