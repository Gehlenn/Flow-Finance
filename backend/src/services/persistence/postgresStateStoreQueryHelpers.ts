import { query } from '../../config/database';
import type {
  PersistedAuditEventRow,
  PersistedDomainEventRow,
  PersistedUsageSnapshot,
  PersistedWorkspaceBillingHookRow,
  PersistedWorkspaceSaasState,
  PersistedWorkspaceUsageEventRow,
} from './postgresStateStoreTypes';

export function buildWhereClause(
  baseClause: string,
  clauses: string[],
): string {
  return [baseClause, ...clauses].join(' AND ');
}

export function addQueryFilter(
  params: unknown[],
  clauses: string[],
  value: unknown,
  buildClause: (index: number) => string,
): void {
  if (value === undefined || value === null || value === '') {
    return;
  }

  params.push(value);
  clauses.push(buildClause(params.length));
}

export function resolveQueryLimit(limit: unknown, maxLimit: number): number | undefined {
  if (!Number.isFinite(limit as number) || (limit as number) <= 0) {
    return undefined;
  }

  return Math.min(Number(limit), maxLimit);
}

export function buildLimitClause(limit: number | undefined): string {
  return limit ? `LIMIT ${limit}` : '';
}

export function mapAuditEventRow(row: Record<string, unknown>): PersistedAuditEventRow {
  return {
    id: String(row.id),
    at: new Date(String(row.at)).toISOString(),
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    workspaceId: typeof row.workspace_id === 'string' ? row.workspace_id : undefined,
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    email: typeof row.email === 'string' ? row.email : undefined,
    action: String(row.action),
    status: String(row.status),
    resourceType: typeof row.resource_type === 'string' ? row.resource_type : undefined,
    resourceId: typeof row.resource_id === 'string' ? row.resource_id : undefined,
    ip: typeof row.ip === 'string' ? row.ip : undefined,
    userAgent: typeof row.user_agent === 'string' ? row.user_agent : undefined,
    resource: typeof row.resource === 'string' ? row.resource : undefined,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
  };
}

export function mapDomainEventRow(row: Record<string, unknown>): PersistedDomainEventRow {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    aggregateId: typeof row.aggregate_id === 'string' ? row.aggregate_id : undefined,
    aggregateType: typeof row.aggregate_type === 'string' ? row.aggregate_type : undefined,
    type: String(row.type),
    payload: typeof row.payload === 'object' && row.payload !== null ? row.payload as Record<string, unknown> : undefined,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
  };
}

export function mapWorkspaceUsageEventRow(row: Record<string, unknown>): PersistedWorkspaceUsageEventRow {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    resource: String(row.resource) as PersistedWorkspaceUsageEventRow['resource'],
    amount: Number(row.amount || 0),
    at: new Date(String(row.at)).toISOString(),
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
  };
}

export function mapWorkspaceBillingHookRow(row: Record<string, unknown>): PersistedWorkspaceBillingHookRow {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    plan: String(row.plan) as PersistedWorkspaceBillingHookRow['plan'],
    event: String(row.event) as PersistedWorkspaceBillingHookRow['event'],
    resource: typeof row.resource === 'string'
      ? row.resource as PersistedWorkspaceBillingHookRow['resource']
      : undefined,
    amount: Number(row.amount || 0),
    at: new Date(String(row.at)).toISOString(),
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : undefined,
  };
}

export function mapUsageSnapshotRow(row: Record<string, unknown>): PersistedUsageSnapshot {
  return {
    transactions: Number(row.transactions || 0),
    aiQueries: Number(row.ai_queries || 0),
    bankConnections: Number(row.bank_connections || 0),
  };
}

export function buildWorkspaceSaasStateFromRows(rows: {
  usageRows: Array<Record<string, unknown>>;
  usageEventRows: Array<Record<string, unknown>>;
  billingHookRows: Array<Record<string, unknown>>;
}): PersistedWorkspaceSaasState {
  const usageByWorkspace: PersistedWorkspaceSaasState['usageByWorkspace'] = {};
  for (const row of rows.usageRows) {
    const workspaceId = String(row.workspace_id);
    usageByWorkspace[workspaceId] = usageByWorkspace[workspaceId] || {};
    usageByWorkspace[workspaceId][String(row.month_key)] = mapUsageSnapshotRow(row);
  }

  const usageEventsByWorkspace: PersistedWorkspaceSaasState['usageEventsByWorkspace'] = {};
  for (const row of rows.usageEventRows) {
    const workspaceId = String(row.workspace_id);
    usageEventsByWorkspace[workspaceId] = usageEventsByWorkspace[workspaceId] || [];
    usageEventsByWorkspace[workspaceId].push(mapWorkspaceUsageEventRow(row));
  }

  const billingHooksByWorkspace: PersistedWorkspaceSaasState['billingHooksByWorkspace'] = {};
  for (const row of rows.billingHookRows) {
    const workspaceId = String(row.workspace_id);
    billingHooksByWorkspace[workspaceId] = billingHooksByWorkspace[workspaceId] || [];
    billingHooksByWorkspace[workspaceId].push(mapWorkspaceBillingHookRow(row));
  }

  return { usageByWorkspace, usageEventsByWorkspace, billingHooksByWorkspace };
}

export function mapRows<T>(rows: Array<Record<string, unknown>>, mapper: (row: Record<string, unknown>) => T): T[] {
  return rows.map((row) => mapper(row));
}

export async function queryMappedRows<T>(
  sql: string,
  params: unknown[],
  mapper: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const result = await query(sql, params);
  return mapRows(result.rows as Array<Record<string, unknown>>, mapper);
}

export async function queryMappedRow<T>(
  sql: string,
  params: unknown[],
  mapper: (row: Record<string, unknown>) => T,
): Promise<T | null> {
  const result = await query(sql, params);
  if (result.rows.length === 0) {
    return null;
  }

  return mapper(result.rows[0] as Record<string, unknown>);
}
