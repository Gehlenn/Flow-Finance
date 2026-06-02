import { query } from '../../config/database';
import type {
  PersistedWorkspaceSaasState,
  PersistedWorkspaceStoreState,
} from './postgresStateStore';

async function insertWorkspaceStoreTenants(state: PersistedWorkspaceStoreState): Promise<void> {
  for (const tenant of state.tenants) {
    await query(`
      INSERT INTO tenants (
        tenant_id, name, plan, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      tenant.tenantId,
      tenant.name,
      tenant.plan,
      tenant.createdAt,
      tenant.updatedAt,
    ]);
  }
}

async function insertWorkspaceStoreWorkspaces(state: PersistedWorkspaceStoreState): Promise<void> {
  for (const workspace of state.workspaces) {
    await query(`
      INSERT INTO workspaces (
        workspace_id, tenant_id, name, is_default, created_at, plan, status, billing_email, billing_customer_id, subscription, entitlements, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
    `, [
      workspace.workspaceId,
      workspace.tenantId,
      workspace.name,
      workspace.isDefault,
      workspace.createdAt,
      workspace.plan,
      workspace.status || 'active',
      workspace.billingEmail || null,
      workspace.billingCustomerId || null,
      JSON.stringify(workspace.subscription || null),
      JSON.stringify(workspace.entitlements || null),
      workspace.updatedAt || workspace.createdAt,
    ]);
  }
}

async function insertWorkspaceStoreUsers(state: PersistedWorkspaceStoreState): Promise<void> {
  for (const workspaceUser of state.workspaceUsers) {
    await query(`
      INSERT INTO workspace_users (
        workspace_id, tenant_id, user_id, role, joined_at, invited_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      workspaceUser.workspaceId,
      workspaceUser.tenantId,
      workspaceUser.userId,
      workspaceUser.role,
      workspaceUser.joinedAt,
      workspaceUser.invitedBy || null,
      workspaceUser.status || 'active',
    ]);
  }
}

async function insertWorkspaceStorePreferences(state: PersistedWorkspaceStoreState): Promise<void> {
  for (const preference of state.userPreferences) {
    await query(`
      INSERT INTO workspace_user_preferences (
        user_id, last_selected_workspace_id, updated_at
      ) VALUES ($1, $2, $3)
    `, [
      preference.userId,
      preference.lastSelectedWorkspaceId || null,
      preference.updatedAt,
    ]);
  }
}

export async function saveWorkspaceStoreRows(state: PersistedWorkspaceStoreState): Promise<void> {
  await insertWorkspaceStoreTenants(state);
  await insertWorkspaceStoreWorkspaces(state);
  await insertWorkspaceStoreUsers(state);
  await insertWorkspaceStorePreferences(state);
}

async function insertWorkspaceUsageSnapshots(state: PersistedWorkspaceSaasState): Promise<void> {
  for (const [workspaceId, usageByMonth] of Object.entries(state.usageByWorkspace)) {
    for (const [monthKey, snapshot] of Object.entries(usageByMonth)) {
      await query(`
        INSERT INTO workspace_monthly_usage (
          workspace_id, month_key, transactions, ai_queries, bank_connections, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        workspaceId,
        monthKey,
        snapshot.transactions,
        snapshot.aiQueries,
        snapshot.bankConnections,
      ]);
    }
  }
}

async function insertWorkspaceUsageEvents(state: PersistedWorkspaceSaasState): Promise<void> {
  for (const events of Object.values(state.usageEventsByWorkspace)) {
    for (const event of events) {
      await query(`
        INSERT INTO workspace_usage_events (
          id, workspace_id, user_id, resource, amount, at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `, [
        event.id,
        event.workspaceId,
        event.userId || null,
        event.resource,
        event.amount,
        event.at,
        JSON.stringify(event.metadata || {}),
      ]);
    }
  }
}

async function insertWorkspaceBillingHooks(state: PersistedWorkspaceSaasState): Promise<void> {
  for (const hooks of Object.values(state.billingHooksByWorkspace)) {
    for (const hook of hooks) {
      await query(`
        INSERT INTO workspace_billing_hooks (
          id, workspace_id, user_id, plan, event, resource, amount, at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `, [
        hook.id,
        hook.workspaceId,
        hook.userId || null,
        hook.plan,
        hook.event,
        hook.resource || null,
        hook.amount,
        hook.at,
        JSON.stringify(hook.metadata || {}),
      ]);
    }
  }
}

export async function saveWorkspaceSaasRows(state: PersistedWorkspaceSaasState): Promise<void> {
  await insertWorkspaceUsageSnapshots(state);
  await insertWorkspaceUsageEvents(state);
  await insertWorkspaceBillingHooks(state);
}
