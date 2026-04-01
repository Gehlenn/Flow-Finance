import { query, testConnection } from '../../config/database';
import logger from '../../config/logger';
import { Workspace, WorkspaceUser, WorkspaceUserPreference } from '../../types';

export type PersistedAuditEventRow = {
  id: string;
  at: string;
  userId?: string;
  email?: string;
  action: string;
  status: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
};

export type PersistedWorkspaceStoreState = {
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
      user_id TEXT,
      email TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      resource TEXT,
      metadata JSONB
    );
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_audit_events_at ON audit_events(at DESC);');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource);');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);');

  await query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      workspace_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
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

  await query(`
    CREATE TABLE IF NOT EXISTS workspace_users (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL,
      invited_by TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      PRIMARY KEY (workspace_id, user_id)
    );
  `);

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

  await query('CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON workspace_users(user_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_monthly_usage_workspace_id ON workspace_monthly_usage(workspace_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_usage_events_workspace_id ON workspace_usage_events(workspace_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_usage_events_at ON workspace_usage_events(at DESC);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_billing_hooks_workspace_id ON workspace_billing_hooks(workspace_id);');
  await query('CREATE INDEX IF NOT EXISTS idx_workspace_billing_hooks_at ON workspace_billing_hooks(at DESC);');

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
      id, at, user_id, email, action, status, ip, user_agent, resource, metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
    )
    ON CONFLICT (id) DO NOTHING
  `, [
    row.id,
    row.at,
    row.userId || null,
    row.email || null,
    row.action,
    row.status,
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

  const result = await query(`
    SELECT id, at, user_id, email, action, status, ip, user_agent, resource, metadata
    FROM audit_events
    ORDER BY at DESC
    LIMIT $1
  `, [limit]);

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    at: new Date(String(row.at)).toISOString(),
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    email: typeof row.email === 'string' ? row.email : undefined,
    action: String(row.action),
    status: String(row.status),
    ip: typeof row.ip === 'string' ? row.ip : undefined,
    userAgent: typeof row.user_agent === 'string' ? row.user_agent : undefined,
    resource: typeof row.resource === 'string' ? row.resource : undefined,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
  }));
}

function mapWorkspaceRow(row: Record<string, unknown>): Workspace {
  return {
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    createdAt: new Date(String(row.created_at)).toISOString(),
    plan: String(row.plan) as Workspace['plan'],
    status: String(row.status || 'active') as Workspace['status'],
    billingEmail: typeof row.billing_email === 'string' ? row.billing_email : undefined,
    billingCustomerId: typeof row.billing_customer_id === 'string' ? row.billing_customer_id : undefined,
    subscription: typeof row.subscription === 'object' && row.subscription !== null
      ? row.subscription as Workspace['subscription']
      : undefined,
    entitlements: typeof row.entitlements === 'object' && row.entitlements !== null
      ? row.entitlements as Workspace['entitlements']
      : undefined,
  };
}

export async function loadWorkspaceStoreState(): Promise<PersistedWorkspaceStoreState | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  const [workspaceResult, workspaceUserResult, preferenceResult] = await Promise.all([
    query(`
      SELECT workspace_id, name, created_at, plan, status, billing_email, billing_customer_id, subscription, entitlements
      FROM workspaces
      ORDER BY created_at ASC
    `),
    query(`
      SELECT workspace_id, user_id, role, joined_at, invited_by, status
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
    workspaceResult.rows.length === 0 &&
    workspaceUserResult.rows.length === 0 &&
    preferenceResult.rows.length === 0
  ) {
    return null;
  }

  return {
    workspaces: workspaceResult.rows.map((row: Record<string, unknown>) => mapWorkspaceRow(row)),
    workspaceUsers: workspaceUserResult.rows.map((row: Record<string, unknown>) => ({
      workspaceId: String(row.workspace_id),
      userId: String(row.user_id),
      role: String(row.role) as WorkspaceUser['role'],
      joinedAt: new Date(String(row.joined_at)).toISOString(),
      invitedBy: typeof row.invited_by === 'string' ? row.invited_by : undefined,
      status: String(row.status || 'active') as WorkspaceUser['status'],
    })),
    userPreferences: preferenceResult.rows.map((row: Record<string, unknown>) => ({
      userId: String(row.user_id),
      lastSelectedWorkspaceId: typeof row.last_selected_workspace_id === 'string'
        ? row.last_selected_workspace_id
        : undefined,
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    })),
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

    for (const workspace of state.workspaces) {
      await query(`
        INSERT INTO workspaces (
          workspace_id, name, created_at, plan, status, billing_email, billing_customer_id, subscription, entitlements, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, NOW())
      `, [
        workspace.workspaceId,
        workspace.name,
        workspace.createdAt,
        workspace.plan,
        workspace.status || 'active',
        workspace.billingEmail || null,
        workspace.billingCustomerId || null,
        JSON.stringify(workspace.subscription || null),
        JSON.stringify(workspace.entitlements || null),
      ]);
    }

    for (const workspaceUser of state.workspaceUsers) {
      await query(`
        INSERT INTO workspace_users (
          workspace_id, user_id, role, joined_at, invited_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        workspaceUser.workspaceId,
        workspaceUser.userId,
        workspaceUser.role,
        workspaceUser.joinedAt,
        workspaceUser.invitedBy || null,
        workspaceUser.status || 'active',
      ]);
    }

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

    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
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

  const usageByWorkspace: PersistedWorkspaceSaasState['usageByWorkspace'] = {};
  for (const row of usageResult.rows as Array<Record<string, unknown>>) {
    const workspaceId = String(row.workspace_id);
    usageByWorkspace[workspaceId] = usageByWorkspace[workspaceId] || {};
    usageByWorkspace[workspaceId][String(row.month_key)] = {
      transactions: Number(row.transactions || 0),
      aiQueries: Number(row.ai_queries || 0),
      bankConnections: Number(row.bank_connections || 0),
    };
  }

  const usageEventsByWorkspace: PersistedWorkspaceSaasState['usageEventsByWorkspace'] = {};
  for (const row of usageEventResult.rows as Array<Record<string, unknown>>) {
    const workspaceId = String(row.workspace_id);
    usageEventsByWorkspace[workspaceId] = usageEventsByWorkspace[workspaceId] || [];
    usageEventsByWorkspace[workspaceId].push({
      id: String(row.id),
      workspaceId,
      userId: typeof row.user_id === 'string' ? row.user_id : undefined,
      resource: String(row.resource) as PersistedWorkspaceUsageEventRow['resource'],
      amount: Number(row.amount || 0),
      at: new Date(String(row.at)).toISOString(),
      metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
    });
  }

  const billingHooksByWorkspace: PersistedWorkspaceSaasState['billingHooksByWorkspace'] = {};
  for (const row of billingHookResult.rows as Array<Record<string, unknown>>) {
    const workspaceId = String(row.workspace_id);
    billingHooksByWorkspace[workspaceId] = billingHooksByWorkspace[workspaceId] || [];
    billingHooksByWorkspace[workspaceId].push({
      id: String(row.id),
      workspaceId,
      userId: typeof row.user_id === 'string' ? row.user_id : undefined,
      plan: String(row.plan) as PersistedWorkspaceBillingHookRow['plan'],
      event: String(row.event) as PersistedWorkspaceBillingHookRow['event'],
      resource: typeof row.resource === 'string'
        ? row.resource as PersistedWorkspaceBillingHookRow['resource']
        : undefined,
      amount: Number(row.amount || 0),
      at: new Date(String(row.at)).toISOString(),
      metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
    });
  }

  return { usageByWorkspace, usageEventsByWorkspace, billingHooksByWorkspace };
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

    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

export async function queryAuditEvents(filters: {
  userId?: string;
  action?: string;
  status?: string;
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

  if (filters.userId) {
    params.push(filters.userId);
    clauses.push(`user_id = $${params.length}`);
  }
  if (filters.action) {
    params.push(filters.action);
    clauses.push(`action = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }
  if (filters.resource) {
    params.push(filters.resource);
    clauses.push(`resource = $${params.length}`);
  }
  if (filters.since) {
    params.push(filters.since);
    clauses.push(`at >= $${params.length}`);
  }
  if (filters.until) {
    params.push(filters.until);
    clauses.push(`at <= $${params.length}`);
  }

  const limit = Number.isFinite(filters.limit) && (filters.limit as number) > 0
    ? Math.min(Number(filters.limit), 5000)
    : undefined;

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limitClause = limit ? `LIMIT ${limit}` : '';

  const result = await query(`
    SELECT id, at, user_id, email, action, status, ip, user_agent, resource, metadata
    FROM audit_events
    ${whereClause}
    ORDER BY at DESC, id DESC
    ${limitClause}
  `, params);

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    at: new Date(String(row.at)).toISOString(),
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    email: typeof row.email === 'string' ? row.email : undefined,
    action: String(row.action),
    status: String(row.status),
    ip: typeof row.ip === 'string' ? row.ip : undefined,
    userAgent: typeof row.user_agent === 'string' ? row.user_agent : undefined,
    resource: typeof row.resource === 'string' ? row.resource : undefined,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
  }));
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

  if (filters.from) {
    params.push(filters.from);
    clauses.push(`to_date(month_key || '-01', 'YYYY-MM-DD') >= date_trunc('month', $${params.length}::timestamptz)::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`to_date(month_key || '-01', 'YYYY-MM-DD') <= date_trunc('month', $${params.length}::timestamptz)::date`);
  }

  const result = await query(`
    SELECT month_key, transactions, ai_queries, bank_connections
    FROM workspace_monthly_usage
    WHERE ${clauses.join(' AND ')}
    ORDER BY month_key DESC
  `, params);

  const months = Object.fromEntries(
    result.rows.map((row: Record<string, unknown>) => [
      String(row.month_key),
      {
        transactions: Number(row.transactions || 0),
        aiQueries: Number(row.ai_queries || 0),
        bankConnections: Number(row.bank_connections || 0),
      },
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

  if (filters.resource) {
    params.push(filters.resource);
    clauses.push(`resource = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`at <= $${params.length}`);
  }

  const limit = Number.isFinite(filters.limit) && (filters.limit as number) > 0
    ? Math.min(Number(filters.limit), 5000)
    : undefined;
  const limitClause = limit ? `LIMIT ${limit}` : '';

  const result = await query(`
    SELECT id, workspace_id, user_id, resource, amount, at, metadata
    FROM workspace_usage_events
    WHERE ${clauses.join(' AND ')}
    ORDER BY at DESC, id DESC
    ${limitClause}
  `, params);

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    resource: String(row.resource) as PersistedWorkspaceUsageEventRow['resource'],
    amount: Number(row.amount || 0),
    at: new Date(String(row.at)).toISOString(),
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
  }));
}

export async function queryWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  const result = await query(`
    SELECT workspace_id, name, created_at, plan, status, billing_email, billing_customer_id, subscription, entitlements
    FROM workspaces
    WHERE workspace_id = $1
    LIMIT 1
  `, [workspaceId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapWorkspaceRow(result.rows[0] as Record<string, unknown>);
}

export async function queryWorkspacesForUser(userId: string): Promise<Workspace[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  const result = await query(`
    SELECT w.workspace_id, w.name, w.created_at, w.plan, w.status, w.billing_email, w.billing_customer_id, w.subscription, w.entitlements
    FROM workspaces w
    INNER JOIN workspace_users wu ON wu.workspace_id = w.workspace_id
    WHERE wu.user_id = $1 AND wu.status = 'active'
    ORDER BY w.created_at ASC
  `, [userId]);

  return result.rows.map((row: Record<string, unknown>) => mapWorkspaceRow(row));
}

export async function queryWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
  if (!await initializePostgresStateStore()) {
    return [];
  }

  const result = await query(`
    SELECT workspace_id, user_id, role, joined_at, invited_by, status
    FROM workspace_users
    WHERE workspace_id = $1
    ORDER BY joined_at ASC
  `, [workspaceId]);

  return result.rows.map((row: Record<string, unknown>) => ({
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    role: String(row.role) as WorkspaceUser['role'],
    joinedAt: new Date(String(row.joined_at)).toISOString(),
    invitedBy: typeof row.invited_by === 'string' ? row.invited_by : undefined,
    status: String(row.status || 'active') as WorkspaceUser['status'],
  }));
}

export async function queryLastWorkspaceForUser(userId: string): Promise<Workspace | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  const result = await query(`
    SELECT w.workspace_id, w.name, w.created_at, w.plan, w.status, w.billing_email, w.billing_customer_id, w.subscription, w.entitlements
    FROM workspace_user_preferences p
    INNER JOIN workspaces w ON w.workspace_id = p.last_selected_workspace_id
    WHERE p.user_id = $1
    LIMIT 1
  `, [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapWorkspaceRow(result.rows[0] as Record<string, unknown>);
}

export async function queryWorkspaceByBillingCustomerId(billingCustomerId: string): Promise<Workspace | null> {
  if (!await initializePostgresStateStore()) {
    return null;
  }

  const result = await query(`
    SELECT workspace_id, name, created_at, plan, status, billing_email, billing_customer_id, subscription, entitlements
    FROM workspaces
    WHERE billing_customer_id = $1
    LIMIT 1
  `, [billingCustomerId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapWorkspaceRow(result.rows[0] as Record<string, unknown>);
}
