import { query, testConnection } from '../../config/database';
import logger from '../../config/logger';
import { Tenant, Workspace, WorkspaceUser, WorkspaceUserPreference } from '../../types';
import {
  addQueryFilter,
  buildWhereClause,
  buildLimitClause,
  buildWorkspaceSaasStateFromRows,
  mapAuditEventRow,
  mapDomainEventRow,
  mapRows,
  mapUsageSnapshotRow,
  mapWorkspaceUsageEventRow,
  queryMappedRow,
  queryMappedRows,
  resolveQueryLimit,
} from './postgresStateStoreQueryHelpers';
import {
  saveWorkspaceSaasRows,
  saveWorkspaceStoreRows,
} from './postgresStateStoreSaveHelpers';
import {
  mapTenantRow,
  mapWorkspaceRow,
  mapWorkspaceUserPreferenceRow,
  mapWorkspaceUserRow,
} from './postgresStateStoreHelpers';

export type PersistedAuditEventRow = {
  id: string;
  at: string;
  tenantId?: string;
  workspaceId?: string;
  userId?: string;
  email?: string;
  action: string;
  status: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
};

export type PersistedWorkspaceStoreState = {
  tenants: Tenant[];
  workspaces: Workspace[];
  workspaceUsers: WorkspaceUser[];
  userPreferences: WorkspaceUserPreference[];
};

export type PersistedUsageSnapshot = {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
};

export type PersistedWorkspaceUsageEventRow = {
  id: string;
  workspaceId: string;
  userId?: string;
  resource: 'transactions' | 'aiQueries' | 'bankConnections';
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
};

export type PersistedWorkspaceBillingHookRow = {
  id: string;
  workspaceId: string;
  userId?: string;
  plan: 'free' | 'pro';
  event: 'usage_recorded' | 'limit_reached' | 'upgrade_required' | 'plan_changed';
  resource?: 'transactions' | 'aiQueries' | 'bankConnections';
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
};

export type PersistedWorkspaceSaasState = {
  usageByWorkspace: Record<string, Record<string, PersistedUsageSnapshot>>;
  billingHooksByWorkspace: Record<string, PersistedWorkspaceBillingHookRow[]>;
  usageEventsByWorkspace: Record<string, PersistedWorkspaceUsageEventRow[]>;
};

export type PersistedDomainEventRow = {
  id: string;
  workspaceId: string;
  tenantId?: string;
  userId?: string;
  aggregateId?: string;
  aggregateType?: string;
  type: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};

let initialized = false;

export function isPostgresStateStoreEnabled(): boolean {
  return String(process.env.POSTGRES_STATE_STORE_ENABLED || '').toLowerCase() === 'true';
}

export async function initializePostgresStateStore(): Promise<boolean> {
  if (!isPostgresStateStoreEnabled()) {
    return false;
  }

  if (initialized) {
    return true;
  }

  const healthy = await testConnection();
  if (!healthy) {
    logger.warn('Postgres state store enabled but database is not reachable');
    return false;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS app_state_store (
      state_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL,
      tenant_id TEXT,
      workspace_id TEXT,
      user_id TEXT,
      email TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      ip TEXT,
      user_agent TEXT,
      resource TEXT,
      metadata JSONB
    );
  `);

  await query('ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;');
  await query('ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS workspace_id TEXT;');
  await query('ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_type TEXT;');
  await query('ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_id TEXT;');

  await query('CREATE INDEX IF NOT EXISTS idx_audit_events_at ON audit_events(at DESC);');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id ON audit_events(tenant_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_id ON audit_events(workspace_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource);');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);');

  await query(`
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      plan TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      workspace_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      billing_email TEXT,
      billing_customer_id TEXT,
      subscription JSONB,
      entitlements JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query('ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tenant_id TEXT;');
  await query('ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;');

  await query(`
    CREATE TABLE IF NOT EXISTS workspace_users (
      workspace_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL,
      invited_by TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      PRIMARY KEY (workspace_id, user_id)
    );
  `);
  await query('ALTER TABLE workspace_users ADD COLUMN IF NOT EXISTS tenant_id TEXT;');

  await query(`
    CREATE TABLE IF NOT EXISTS workspace_user_preferences (
      user_id TEXT PRIMARY KEY,
      last_selected_workspace_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workspace_monthly_usage (
      workspace_id TEXT NOT NULL,
      month_key TEXT NOT NULL,
      transactions INTEGER NOT NULL DEFAULT 0,
      ai_queries INTEGER NOT NULL DEFAULT 0,
      bank_connections INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, month_key)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workspace_usage_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT,
      resource TEXT NOT NULL,
      amount INTEGER NOT NULL,
      at TIMESTAMPTZ NOT NULL,
      metadata JSONB
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workspace_billing_hooks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT,
      plan TEXT NOT NULL,
      event TEXT NOT NULL,
      resource TEXT,
      amount INTEGER NOT NULL,
      at TIMESTAMPTZ NOT NULL,
      metadata JSONB
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS domain_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      tenant_id TEXT,
      user_id TEXT,
      aggregate_id TEXT,
      aggregate_type TEXT,
      type TEXT NOT NULL,
      payload JSONB,
      metadata JSONB,
      occurred_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON workspace_users(user_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_users_tenant_id ON workspace_users(tenant_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_monthly_usage_workspace_id ON workspace_monthly_usage(workspace_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_usage_events_workspace_id ON workspace_usage_events(workspace_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_usage_events_at ON workspace_usage_events(at DESC);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_billing_hooks_workspace_id ON workspace_billing_hooks(workspace_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_billing_hooks_at ON workspace_billing_hooks(at DESC);');
  await query('CREATE INDEX IF NOT EXISTS idx_domain_events_workspace_id ON domain_events(workspace_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate_id ON domain_events(aggregate_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_domain_events_occurred_at ON domain_events(occurred_at DESC);');

  initialized = true;
  logger.info('Postgres state store initialized');
  return true;
}

export async function loadJsonState<T>(stateKey: string): Promise<T | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  const result = await query('SELECT payload FROM app_state_store WHERE state_key = $1', [stateKey]);
  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].payload as T;
}

export async function saveJsonState(stateKey: string, payload: unknown): Promise<void> {
  if (!await initializePostgresStateStore()) {
    return;
  }

  await query(`
    INSERT INTO app_state_store (state_key, payload, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (state_key)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
  `, [stateKey, JSON.stringify(payload)]);
}

export async function insertAuditEvent(row: PersistedAuditEventRow): Promise<void> {
  if (!await initializePostgresStateStore()) {
    return;
  }

  await query(`
    INSERT INTO audit_events (
      id, at, tenant_id, workspace_id, user_id, email, action, status, resource_type, resource_id, ip, user_agent, resource, metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
    )
    ON CONFLICT (id) DO NOTHING
  `, [
    row.id,
    row.at,
    row.tenantId || null,
    row.workspaceId || null,
    row.userId || null,
    row.email || null,
    row.action,
    row.status,
    row.resourceType || null,
    row.resourceId || null,
    row.ip || null,
    row.userAgent || null,
    row.resource || null,
    JSON.stringify(row.metadata || {}),
  ]);
}

export async function loadRecentAuditEvents(limit = 10000): Promise<PersistedAuditEventRow[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  return queryMappedRows(`
    SELECT id, at, tenant_id, workspace_id, user_id, email, action, status, resource_type, resource_id, ip, user_agent, resource, metadata
    FROM audit_events
    ORDER BY at DESC
    LIMIT $1
  `, [limit], mapAuditEventRow);
}

export async function loadWorkspaceStoreState(): Promise<PersistedWorkspaceStoreState | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  const [tenantResult, workspaceResult, workspaceUserResult, preferenceResult] = await Promise.all([
    query(`
      SELECT tenant_id, name, plan, created_at, updated_at
      FROM tenants
      ORDER BY created_at ASC
    `),
    query(`
      SELECT workspace_id, tenant_id, name, is_default, created_at, updated_at, plan, status, billing_email, billing_customer_id, subscription, entitlements
      FROM workspaces
      ORDER BY created_at ASC
    `),
    query(`
      SELECT workspace_id, tenant_id, user_id, role, joined_at, invited_by, status
      FROM workspace_users
      ORDER BY joined_at ASC
    `),
    query(`
      SELECT user_id, last_selected_workspace_id, updated_at
      FROM workspace_user_preferences
      ORDER BY updated_at DESC
    `),
  ]);

  if (
    tenantResult.rows.length === 0 &&
    workspaceResult.rows.length === 0 &&
    workspaceUserResult.rows.length === 0 &&
    preferenceResult.rows.length === 0
  ) {
    return null;
  }

  return {
    tenants: mapRows(tenantResult.rows as Array<Record<string, unknown>>, mapTenantRow),
    workspaces: mapRows(workspaceResult.rows as Array<Record<string, unknown>>, mapWorkspaceRow),
    workspaceUsers: mapRows(workspaceUserResult.rows as Array<Record<string, unknown>>, mapWorkspaceUserRow),
    userPreferences: mapRows(preferenceResult.rows as Array<Record<string, unknown>>, mapWorkspaceUserPreferenceRow),
  };
}

export async function saveWorkspaceStoreState(state: PersistedWorkspaceStoreState): Promise<void> {
  if (!await initializePostgresStateStore()) {
    return;
  }

  await query('BEGIN');
  try {
    await query('DELETE FROM workspace_user_preferences');
    await query('DELETE FROM workspace_users');
    await query('DELETE FROM workspaces');
    await query('DELETE FROM tenants');
    await saveWorkspaceStoreRows(state);

    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
    logger.error({
      error,
      tenantCount: state.tenants.length,
      workspaceCount: state.workspaces.length,
      workspaceUserCount: state.workspaceUsers.length,
      preferenceCount: state.userPreferences.length,
      fallback: 'workspace-store-save-failed',
    }, 'Failed to persist workspace store state');
    throw error;
  }
}

export async function loadWorkspaceSaasState(): Promise<PersistedWorkspaceSaasState | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  const [usageResult, usageEventResult, billingHookResult] = await Promise.all([
    query(`
      SELECT workspace_id, month_key, transactions, ai_queries, bank_connections
      FROM workspace_monthly_usage
      ORDER BY workspace_id ASC, month_key ASC
    `),
    query(`
      SELECT id, workspace_id, user_id, resource, amount, at, metadata
      FROM workspace_usage_events
      ORDER BY at DESC
    `),
    query(`
      SELECT id, workspace_id, user_id, plan, event, resource, amount, at, metadata
      FROM workspace_billing_hooks
      ORDER BY at DESC
    `),
  ]);

  if (
    usageResult.rows.length === 0 &&
    usageEventResult.rows.length === 0 &&
    billingHookResult.rows.length === 0
  ) {
    return null;
  }

  return buildWorkspaceSaasStateFromRows({
    usageRows: usageResult.rows as Array<Record<string, unknown>>,
    usageEventRows: usageEventResult.rows as Array<Record<string, unknown>>,
    billingHookRows: billingHookResult.rows as Array<Record<string, unknown>>,
  });
}

export async function saveWorkspaceSaasState(state: PersistedWorkspaceSaasState): Promise<void> {
  if (!await initializePostgresStateStore()) {
    return;
  }

  await query('BEGIN');
  try {
    await query('DELETE FROM workspace_monthly_usage');
    await query('DELETE FROM workspace_usage_events');
    await query('DELETE FROM workspace_billing_hooks');
    await saveWorkspaceSaasRows(state);

    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
    logger.error({
      error,
      workspaceCount: Object.keys(state.usageByWorkspace).length,
      usageEventWorkspaceCount: Object.keys(state.usageEventsByWorkspace).length,
      billingHookWorkspaceCount: Object.keys(state.billingHooksByWorkspace).length,
      fallback: 'saas-state-save-failed',
    }, 'Failed to persist workspace SaaS state');
    throw error;
  }
}

export async function queryAuditEvents(filters: {
  tenantId?: string;
  workspaceId?: string;
  userId?: string;
  action?: string;
  status?: string;
  resourceType?: string;
  resourceId?: string;
  resource?: string;
  limit?: number;
  since?: string;
  until?: string;
} = {}): Promise<PersistedAuditEventRow[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  const clauses: string[] = [];
  const params: unknown[] = [];

  addQueryFilter(params, clauses, filters.tenantId, (index) => `tenant_id = $${index}`);
  addQueryFilter(params, clauses, filters.workspaceId, (index) => `workspace_id = $${index}`);
  addQueryFilter(params, clauses, filters.userId, (index) => `user_id = $${index}`);
  addQueryFilter(params, clauses, filters.action, (index) => `action = $${index}`);
  addQueryFilter(params, clauses, filters.status, (index) => `status = $${index}`);
  addQueryFilter(params, clauses, filters.resourceType, (index) => `resource_type = $${index}`);
  addQueryFilter(params, clauses, filters.resourceId, (index) => `resource_id = $${index}`);
  addQueryFilter(params, clauses, filters.resource, (index) => `resource = $${index}`);
  addQueryFilter(params, clauses, filters.since, (index) => `at >= $${index}`);
  addQueryFilter(params, clauses, filters.until, (index) => `at <= $${index}`);

  const limit = resolveQueryLimit(filters.limit, 5000);

  const whereClause = buildWhereClause('WHERE 1=1', clauses);
  const limitClause = buildLimitClause(limit);

  const result = await query(`
    SELECT id, at, tenant_id, workspace_id, user_id, email, action, status, resource_type, resource_id, ip, user_agent, resource, metadata
    FROM audit_events
    ${whereClause}
    ORDER BY at DESC, id DESC
    ${limitClause}
  `, params);

  return mapRows(result.rows as Array<Record<string, unknown>>, mapAuditEventRow);
}

export async function queryWorkspaceMeteringSummary(
  workspaceId: string,
  filters: {
    from?: string;
    to?: string;
    resource?: PersistedWorkspaceUsageEventRow['resource'];
  } = {},
): Promise<{
  totals: PersistedUsageSnapshot;
  months: Record<string, PersistedUsageSnapshot>;
}> {
  if (!await initializePostgresStateStore()) {
    return { totals: { transactions: 0, aiQueries: 0, bankConnections: 0 }, months: {} };
  }

  const params: unknown[] = [workspaceId];
  const clauses = ['workspace_id = $1'];

  addQueryFilter(
    params,
    clauses,
    filters.from,
    (index) => `to_date(month_key || '-01', 'YYYY-MM-DD') >= date_trunc('month', $${index}::timestamptz)::date`,
  );
  addQueryFilter(
    params,
    clauses,
    filters.to,
    (index) => `to_date(month_key || '-01', 'YYYY-MM-DD') <= date_trunc('month', $${index}::timestamptz)::date`,
  );

  const whereClause = buildWhereClause('WHERE 1=1', clauses);
  const result = await query(`
    SELECT month_key, transactions, ai_queries, bank_connections
    FROM workspace_monthly_usage
    ${whereClause}
    ORDER BY month_key DESC
  `, params);

  const months = Object.fromEntries(
    mapRows(result.rows as Array<Record<string, unknown>>, (row) => [
      String(row.month_key),
      mapUsageSnapshotRow(row),
    ]),
  ) as Record<string, PersistedUsageSnapshot>;

  const totals = Object.values(months).reduce<PersistedUsageSnapshot>((acc, snapshot) => ({
    transactions: acc.transactions + (filters.resource === 'transactions' || !filters.resource ? snapshot.transactions : 0),
    aiQueries: acc.aiQueries + (filters.resource === 'aiQueries' || !filters.resource ? snapshot.aiQueries : 0),
    bankConnections: acc.bankConnections + (filters.resource === 'bankConnections' || !filters.resource ? snapshot.bankConnections : 0),
  }), {
    transactions: 0,
    aiQueries: 0,
    bankConnections: 0,
  });

  return { totals, months };
}

export async function queryWorkspaceUsageEvents(
  workspaceId: string,
  filters: {
    from?: string;
    to?: string;
    resource?: PersistedWorkspaceUsageEventRow['resource'];
    limit?: number;
  } = {},
): Promise<PersistedWorkspaceUsageEventRow[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  const params: unknown[] = [workspaceId];
  const clauses = ['workspace_id = $1'];

  addQueryFilter(params, clauses, filters.resource, (index) => `resource = $${index}`);
  addQueryFilter(params, clauses, filters.from, (index) => `at >= $${index}`);
  addQueryFilter(params, clauses, filters.to, (index) => `at <= $${index}`);

  const limit = resolveQueryLimit(filters.limit, 5000);
  const limitClause = buildLimitClause(limit);

  const whereClause = buildWhereClause('WHERE 1=1', clauses);
  return queryMappedRows(`
    SELECT id, workspace_id, user_id, resource, amount, at, metadata
    FROM workspace_usage_events
    ${whereClause}
    ORDER BY at DESC, id DESC
    ${limitClause}
  `, params, mapWorkspaceUsageEventRow);
}

export async function queryWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  return queryMappedRow(`
    SELECT workspace_id, tenant_id, name, is_default, created_at, updated_at, plan, status, billing_email, billing_customer_id, subscription, entitlements
    FROM workspaces
    WHERE workspace_id = $1
    LIMIT 1
  `, [workspaceId], mapWorkspaceRow);
}

export async function queryWorkspacesForUser(userId: string): Promise<Workspace[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  return queryMappedRows(`
    SELECT w.workspace_id, w.tenant_id, w.name, w.is_default, w.created_at, w.updated_at, w.plan, w.status, w.billing_email, w.billing_customer_id, w.subscription, w.entitlements
    FROM workspaces w
    INNER JOIN workspace_users wu ON wu.workspace_id = w.workspace_id
    WHERE wu.user_id = $1 AND wu.status = 'active'
    ORDER BY w.created_at ASC
  `, [userId], mapWorkspaceRow);
}

export async function queryWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  return queryMappedRows(`
    SELECT workspace_id, tenant_id, user_id, role, joined_at, invited_by, status
    FROM workspace_users
    WHERE workspace_id = $1
    ORDER BY joined_at ASC
  `, [workspaceId], mapWorkspaceUserRow);
}

export async function queryLastWorkspaceForUser(userId: string): Promise<Workspace | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  return queryMappedRow(`
    SELECT w.workspace_id, w.tenant_id, w.name, w.is_default, w.created_at, w.updated_at, w.plan, w.status, w.billing_email, w.billing_customer_id, w.subscription, w.entitlements
    FROM workspace_user_preferences p
    INNER JOIN workspaces w ON w.workspace_id = p.last_selected_workspace_id
    WHERE p.user_id = $1
    LIMIT 1
  `, [userId], mapWorkspaceRow);
}

export async function queryWorkspaceByBillingCustomerId(billingCustomerId: string): Promise<Workspace | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  return queryMappedRow(`
    SELECT workspace_id, tenant_id, name, is_default, created_at, updated_at, plan, status, billing_email, billing_customer_id, subscription, entitlements
    FROM workspaces
    WHERE billing_customer_id = $1
    LIMIT 1
  `, [billingCustomerId], mapWorkspaceRow);
}

export async function queryTenantById(tenantId: string): Promise<Tenant | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  return queryMappedRow(`
    SELECT tenant_id, name, plan, created_at, updated_at
    FROM tenants
    WHERE tenant_id = $1
    LIMIT 1
  `, [tenantId], mapTenantRow);
}

export async function queryTenantsForUser(userId: string): Promise<Tenant[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  return queryMappedRows(`
    SELECT DISTINCT t.tenant_id, t.name, t.plan, t.created_at, t.updated_at
    FROM tenants t
    INNER JOIN workspace_users wu ON wu.tenant_id = t.tenant_id
    WHERE wu.user_id = $1 AND wu.status = 'active'
    ORDER BY t.created_at ASC
  `, [userId], mapTenantRow);
}

export async function insertDomainEvent(row: PersistedDomainEventRow): Promise<void> {
  if (!await initializePostgresStateStore()) {
    return;
  }

  await query(`
    INSERT INTO domain_events (
      id, workspace_id, tenant_id, user_id, aggregate_id, aggregate_type, type, payload, metadata, occurred_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10
    )
    ON CONFLICT (id) DO NOTHING
  `, [
    row.id,
    row.workspaceId,
    row.tenantId || null,
    row.userId || null,
    row.aggregateId || null,
    row.aggregateType || null,
    row.type,
    JSON.stringify(row.payload || {}),
    JSON.stringify(row.metadata || {}),
    row.occurredAt,
  ]);
}

export async function queryDomainEvents(filters: {
  workspaceId: string;
  aggregateId?: string;
  aggregateType?: string;
  type?: string;
  userId?: string;
  since?: string;
  until?: string;
  limit?: number;
}): Promise<PersistedDomainEventRow[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  const params: unknown[] = [filters.workspaceId];
  const clauses = ['workspace_id = $1'];

  addQueryFilter(params, clauses, filters.aggregateId, (index) => `aggregate_id = $${index}`);
  addQueryFilter(params, clauses, filters.aggregateType, (index) => `aggregate_type = $${index}`);
  addQueryFilter(params, clauses, filters.type, (index) => `type = $${index}`);
  addQueryFilter(params, clauses, filters.userId, (index) => `user_id = $${index}`);
  addQueryFilter(params, clauses, filters.since, (index) => `occurred_at >= $${index}`);
  addQueryFilter(params, clauses, filters.until, (index) => `occurred_at <= $${index}`);

  const limit = resolveQueryLimit(filters.limit, 1000) ?? 100;

  params.push(limit);
  const whereClause = buildWhereClause('WHERE 1=1', clauses);
  return queryMappedRows(`
    SELECT id, workspace_id, tenant_id, user_id, aggregate_id, aggregate_type, type, payload, metadata, occurred_at
    FROM domain_events
    ${whereClause}
    ORDER BY occurred_at DESC, id DESC
    LIMIT $${params.length}
  `, params, mapDomainEventRow);
}
