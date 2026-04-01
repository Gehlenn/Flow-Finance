import { randomUUID } from 'crypto';
import { AppError } from '../shared/AppError';
import { Workspace, WorkspacePlan, WorkspaceSubscription } from '../types';
import { getWorkspaceAsync, updateWorkspaceBilling } from '../services/admin/workspaceStore';
import { recordAuditEvent } from '../services/admin/auditLog';

function makeRenewalDate(plan: WorkspacePlan): string {
  const renewal = new Date();
  renewal.setDate(renewal.getDate() + (plan === 'pro' ? 30 : 14));
  return renewal.toISOString();
}

export class BillingService {
  async createSubscription(input: {
    workspaceId: string;
    plan: WorkspacePlan;
    actorUserId: string;
    billingEmail?: string;
  }): Promise<Workspace> {
    const workspace = await getWorkspaceAsync(input.workspaceId);
    if (!workspace) {
      throw new AppError(404, 'Workspace not found');
    }

    const startedAt = new Date().toISOString();
    const subscription: WorkspaceSubscription = {
      subscriptionId: `sub_${randomUUID()}`,
      provider: 'internal',
      status: 'active',
      plan: input.plan,
      startedAt,
      renewsAt: makeRenewalDate(input.plan),
    };

    const updated = updateWorkspaceBilling(input.workspaceId, {
      plan: input.plan,
      billingEmail: input.billingEmail,
      billingCustomerId: workspace.billingCustomerId || `cust_${workspace.workspaceId}`,
      subscription,
    });

    if (!updated) {
      throw new AppError(500, 'Failed to persist subscription state');
    }

    recordAuditEvent({
      userId: input.actorUserId,
      action: 'billing.plan_changed',
      status: 'success',
      resource: input.workspaceId,
      metadata: {
        workspaceId: input.workspaceId,
        previousPlan: workspace.plan,
        currentPlan: input.plan,
        subscriptionId: subscription.subscriptionId,
      },
    });

    return updated;
  }

  async exportWorkspaceData(input: { workspaceId: string }): Promise<{ url: string; generatedAt: string }> {
    const workspace = await getWorkspaceAsync(input.workspaceId);
    if (!workspace) {
      throw new AppError(404, 'Workspace not found');
    }

    const generatedAt = new Date().toISOString();
    return {
      url: `https://exports.flow-finance.local/workspaces/${workspace.workspaceId}/export-${generatedAt}.json`,
      generatedAt,
    };
  }

  async syncProviderSubscription(input: {
    workspaceId: string;
    provider: 'stripe';
    plan: WorkspacePlan;
    actorUserId?: string;
    billingEmail?: string;
    billingCustomerId?: string;
    providerSubscriptionId?: string;
    providerPriceId?: string;
    status?: WorkspaceSubscription['status'];
    renewsAt?: string;
    startedAt?: string;
  }): Promise<Workspace> {
    const workspace = await getWorkspaceAsync(input.workspaceId);
    if (!workspace) {
      throw new AppError(404, 'Workspace not found');
    }

    const startedAt = input.startedAt || workspace.subscription?.startedAt || new Date().toISOString();
    const nextStatus = input.status || workspace.subscription?.status || 'active';
    const subscription: WorkspaceSubscription = {
      subscriptionId: workspace.subscription?.subscriptionId || `sub_${randomUUID()}`,
      provider: input.provider,
      status: nextStatus,
      plan: input.plan,
      startedAt,
      renewsAt: input.renewsAt || workspace.subscription?.renewsAt || makeRenewalDate(input.plan),
      canceledAt: nextStatus === 'canceled' ? new Date().toISOString() : undefined,
      providerCustomerId: input.billingCustomerId || workspace.subscription?.providerCustomerId,
      providerSubscriptionId: input.providerSubscriptionId || workspace.subscription?.providerSubscriptionId,
      providerPriceId: input.providerPriceId || workspace.subscription?.providerPriceId,
      updatedAt: new Date().toISOString(),
    };

    const updated = updateWorkspaceBilling(input.workspaceId, {
      plan: input.plan,
      billingEmail: input.billingEmail,
      billingCustomerId: input.billingCustomerId,
      subscription,
    });

    if (!updated) {
      throw new AppError(500, 'Failed to persist provider subscription state');
    }

    recordAuditEvent({
      userId: input.actorUserId,
      action: 'billing.plan_changed',
      status: 'success',
      resource: input.workspaceId,
      metadata: {
        workspaceId: input.workspaceId,
        previousPlan: workspace.plan,
        currentPlan: input.plan,
        provider: input.provider,
        providerSubscriptionId: input.providerSubscriptionId,
        providerCustomerId: input.billingCustomerId,
      },
    });

    return updated;
  }
}

export const billingService = new BillingService();
