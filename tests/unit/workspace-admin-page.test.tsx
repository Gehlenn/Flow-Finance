import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  getWorkspacePlanCatalog: vi.fn(),
  createWorkspaceCheckoutSession: vi.fn(),
  createWorkspacePortalSession: vi.fn(),
  locationAssign: vi.fn(),
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

vi.mock('../../src/saas/billingClient', () => ({
  getWorkspacePlanCatalog: workspaceAdminMocks.getWorkspacePlanCatalog,
  createWorkspaceCheckoutSession: workspaceAdminMocks.createWorkspaceCheckoutSession,
  createWorkspacePortalSession: workspaceAdminMocks.createWorkspacePortalSession,
}));

import WorkspaceAdminPage from '../../pages/WorkspaceAdmin';

function setup(
  role: 'owner' | 'viewer',
  options?: {
    currentPlan?: 'free' | 'pro';
    stripeConfigured?: boolean;
    stripePortalEnabled?: boolean;
    hasBillingCustomer?: boolean;
    manualPlanChangeAllowed?: boolean;
    billingProvider?: 'stripe' | 'mock' | 'none';
  },
) {
  const currentPlan = options?.currentPlan || 'free';
  const stripeConfigured = options?.stripeConfigured ?? false;
  const stripePortalEnabled = options?.stripePortalEnabled ?? false;
  const hasBillingCustomer = options?.hasBillingCustomer ?? false;
  const manualPlanChangeAllowed = options?.manualPlanChangeAllowed ?? true;
  const billingProvider = options?.billingProvider || (stripeConfigured ? 'stripe' : manualPlanChangeAllowed ? 'mock' : 'none');

  workspaceAdminMocks.getCurrentWorkspaceIdentity.mockReturnValue({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });
  workspaceAdminMocks.listUserWorkspaces.mockResolvedValue([{ workspaceId: 'ws-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', name: 'Workspace 1', plan: currentPlan, role, isDefault: true }]);
  workspaceAdminMocks.ensureActiveWorkspace.mockResolvedValue({ workspaceId: 'ws-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', name: 'Workspace 1', plan: currentPlan, role, isDefault: true });
  workspaceAdminMocks.getWorkspaceBillingOverview.mockResolvedValue({
    currentPlan,
    usage: { '2026-04': { transactions: 2, aiQueries: 1, bankConnections: 0 } },
    currentMonthUsage: { transactions: 2, aiQueries: 1, bankConnections: 0 },
    billingState: { workspaceId: 'ws-1', tenantId: 'tenant-1', plan: currentPlan, status: 'active', updatedAt: '2026-04-02T00:00:00.000Z', updatedByUserId: 'user-1' },
    billingHooks: [],
  });
  workspaceAdminMocks.getWorkspacePlanCatalog.mockResolvedValue({
    scope: 'workspace',
    workspaceId: 'ws-1',
    currentPlan,
    mockBillingEnabled: manualPlanChangeAllowed,
    stripeConfigured,
    stripePortalEnabled,
    hasBillingCustomer,
    billingProvider,
    manualPlanChangeAllowed,
    plans: [],
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
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        href: 'http://localhost:3000/',
        assign: workspaceAdminMocks.locationAssign,
      },
    });
  });

  it('shows billing, member and audit sections for owner', async () => {
    setup('owner');

    await waitFor(() => {
      expect(screen.getByText(/Billing and usage/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/Member user id/i)).toBeTruthy();
      expect(screen.getByText(/Audit trail/i)).toBeTruthy();
    });
  });

  it('starts Stripe checkout when billing provider is real and workspace is free', async () => {
    workspaceAdminMocks.createWorkspaceCheckoutSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://billing.example/checkout',
    });

    setup('owner', {
      currentPlan: 'free',
      stripeConfigured: true,
      manualPlanChangeAllowed: false,
      billingProvider: 'stripe',
    });

    await waitFor(() => {
      expect(screen.getByText(/Start Pro checkout/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/Start Pro checkout/i));

    await waitFor(() => {
      expect(workspaceAdminMocks.createWorkspaceCheckoutSession).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        returnUrl: 'http://localhost:3000/',
      });
      expect(workspaceAdminMocks.locationAssign).toHaveBeenCalledWith('https://billing.example/checkout');
    });
  });

  it('opens Stripe portal when workspace is already pro and linked to customer', async () => {
    workspaceAdminMocks.createWorkspacePortalSession.mockResolvedValue({
      url: 'https://billing.example/portal',
    });

    setup('owner', {
      currentPlan: 'pro',
      stripeConfigured: true,
      stripePortalEnabled: true,
      hasBillingCustomer: true,
      manualPlanChangeAllowed: false,
      billingProvider: 'stripe',
    });

    await waitFor(() => {
      expect(screen.getByText(/Open billing portal/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/Open billing portal/i));

    await waitFor(() => {
      expect(workspaceAdminMocks.createWorkspacePortalSession).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        returnUrl: 'http://localhost:3000/',
      });
      expect(workspaceAdminMocks.locationAssign).toHaveBeenCalledWith('https://billing.example/portal');
    });
  });

  it('keeps mock plan actions when Stripe is not configured', async () => {
    setup('owner', {
      currentPlan: 'free',
      stripeConfigured: false,
      manualPlanChangeAllowed: true,
      billingProvider: 'mock',
    });

    await waitFor(() => {
      expect(screen.getByText(/^Set Pro$/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/^Set Pro$/i));

    await waitFor(() => {
      expect(workspaceAdminMocks.updateWorkspacePlan).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        plan: 'pro',
      });
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
