import { Request, Response } from 'express';
import { getWorkspaceUsers } from '../services/admin/workspaceStore';
import { getAuditEvents } from '../services/admin/auditLog';
import { getWorkspaceMeteringSummary, getWorkspaceUsageEvents, ResourceKind } from '../utils/saasStore';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import {
  isPostgresStateStoreEnabled,
  queryAuditEvents,
  queryWorkspaceMeteringSummary,
  queryWorkspaceUsageEvents,
} from '../services/persistence/postgresStateStore';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
  if (!workspaceId) {
    throw new AppError(400, 'Workspace context is required');
  }

  const users = getWorkspaceUsers(workspaceId);
  res.json(users);
});

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
  if (!workspaceId) {
    throw new AppError(400, 'Workspace context is required');
  }

  const filters = {
    resource: workspaceId,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    since: typeof req.query.since === 'string' ? req.query.since : undefined,
    until: typeof req.query.until === 'string' ? req.query.until : undefined,
  };

  const sourceLogs = isPostgresStateStoreEnabled()
    ? await queryAuditEvents(filters)
    : getAuditEvents(filters);

  const logs = paginateByCursor(sourceLogs, typeof req.query.cursor === 'string' ? req.query.cursor : undefined);

  res.json({
    items: logs,
    nextCursor: logs.length > 0 ? buildCursor(logs[logs.length - 1].at, logs[logs.length - 1].id) : null,
  });
});

export const listUsageMetering = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
  if (!workspaceId) {
    throw new AppError(400, 'Workspace context is required');
  }

  const resource =
    typeof req.query.resource === 'string'
      ? req.query.resource as ResourceKind
      : undefined;

  const filters = {
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    resource,
  };

  const eventFilters = {
    ...filters,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : 100,
  };

  const summary = isPostgresStateStoreEnabled()
    ? await queryWorkspaceMeteringSummary(workspaceId, filters)
    : getWorkspaceMeteringSummary(workspaceId, filters);

  const sourceEvents = isPostgresStateStoreEnabled()
    ? await queryWorkspaceUsageEvents(workspaceId, eventFilters)
    : getWorkspaceUsageEvents(workspaceId, eventFilters);

  const events = paginateByCursor(sourceEvents, typeof req.query.cursor === 'string' ? req.query.cursor : undefined);

  res.json({
    workspaceId,
    filters,
    summary,
    events,
    nextCursor: events.length > 0 ? buildCursor(events[events.length - 1].at, events[events.length - 1].id) : null,
  });
});

export const exportAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
  if (!workspaceId) {
    throw new AppError(400, 'Workspace context is required');
  }

  const filters = {
    resource: workspaceId,
    since: typeof req.query.since === 'string' ? req.query.since : undefined,
    until: typeof req.query.until === 'string' ? req.query.until : undefined,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
  };

  const logs = isPostgresStateStoreEnabled()
    ? await queryAuditEvents(filters)
    : getAuditEvents(filters);

  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const fileName = `audit-logs-${workspaceId}.${format}`;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(toCsv(logs.map((log) => ({
      id: log.id,
      at: log.at,
      userId: log.userId || '',
      action: log.action,
      status: log.status,
      resource: log.resource || '',
      metadata: JSON.stringify(log.metadata || {}),
    }))));
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.json({ workspaceId, logs });
});

export const exportUsageMetering = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
  if (!workspaceId) {
    throw new AppError(400, 'Workspace context is required');
  }

  const resource =
    typeof req.query.resource === 'string'
      ? req.query.resource as ResourceKind
      : undefined;

  const filters = {
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    resource,
  };

  const eventFilters = {
    ...filters,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
  };

  const summary = isPostgresStateStoreEnabled()
    ? await queryWorkspaceMeteringSummary(workspaceId, filters)
    : getWorkspaceMeteringSummary(workspaceId, filters);

  const events = isPostgresStateStoreEnabled()
    ? await queryWorkspaceUsageEvents(workspaceId, eventFilters)
    : getWorkspaceUsageEvents(workspaceId, eventFilters);

  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const fileName = `usage-metering-${workspaceId}.${format}`;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(toCsv(events.map((event) => ({
      id: event.id,
      at: event.at,
      userId: event.userId || '',
      resource: event.resource,
      amount: event.amount,
      metadata: JSON.stringify(event.metadata || {}),
    }))));
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.json({ workspaceId, filters, summary, events });
});

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n');
}

function buildCursor(at: string, id: string): string {
  return Buffer.from(JSON.stringify({ at, id }), 'utf8').toString('base64');
}

function parseCursor(cursor?: string): { at: string; id: string } | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as { at?: string; id?: string };
    if (typeof decoded.at !== 'string' || typeof decoded.id !== 'string') {
      return null;
    }
    return { at: decoded.at, id: decoded.id };
  } catch {
    return null;
  }
}

function paginateByCursor<T extends { at: string; id: string }>(items: T[], cursor?: string): T[] {
  const parsed = parseCursor(cursor);
  if (!parsed) {
    return items;
  }

  return items.filter((item) => {
    if (item.at < parsed.at) {
      return true;
    }
    if (item.at > parsed.at) {
      return false;
    }
    return item.id < parsed.id;
  });
}
