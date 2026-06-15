import { describe, expect, it } from 'vitest';

import {
  buildNormalization,
  determineResult,
  normalizeFinanceEvent,
  parseArgs,
  resolveLoginCredentials,
} from '../../scripts/export-activation-retention-events.mjs';

describe('export-activation-retention-events', () => {
  it('parses inline CLI arguments', () => {
    const args = parseArgs([
      '--backend-url=https://api.example.com',
      '--workspace-id', 'ws-1',
      '--bearer-token', 'token-1',
      '--output-dir', 'test-results/custom-export',
      '--limit', '250',
      '--max-pages', '3',
    ]);

    expect(args.backendUrl).toBe('https://api.example.com');
    expect(args.workspaceId).toBe('ws-1');
    expect(args.bearerToken).toBe('token-1');
    expect(args.outputDir).toBe('test-results/custom-export');
    expect(args.limit).toBe('250');
    expect(args.maxPages).toBe('3');
  });

  it('parses published login bootstrap arguments', () => {
    const args = parseArgs([
      '--backend-url=https://api.example.com',
      '--email', 'ops@example.com',
      '--password=secret-1',
    ]);

    expect(args.backendUrl).toBe('https://api.example.com');
    expect(args.email).toBe('ops@example.com');
    expect(args.password).toBe('secret-1');
  });

  it('normalizes finance events into the export contract', () => {
    const normalized = normalizeFinanceEvent({
      type: 'activation_first_transaction',
      occurredAt: '2026-06-05T12:00:00.000Z',
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    expect(normalized).toMatchObject({
      event_name: 'activation_first_transaction',
      occurred_at: '2026-06-05T12:00:00.000Z',
      workspace_id: 'ws-1',
      user_id: 'user-1',
      valid: true,
    });
  });

  it('keeps completed financial base activation in the export contract', () => {
    const exportState = buildNormalization([
      {
        type: 'activation_financial_base_completed',
        occurredAt: '2026-06-05T12:00:00.000Z',
        workspaceId: 'ws-1',
        userId: 'user-1',
      },
      {
        type: 'weekly_cash_review_completed',
        occurredAt: '2026-06-06T12:00:00.000Z',
        workspaceId: 'ws-1',
        userId: 'user-1',
      },
    ]);

    expect(exportState.exportRows.map((row) => row.event_name)).toEqual([
      'activation_financial_base_completed',
      'weekly_cash_review_completed',
    ]);
    expect(exportState.activationRows).toHaveLength(1);
  });

  it('keeps the export blocked until both activation and retention evidence exist', () => {
    const exportState = buildNormalization([
      {
        type: 'activation_first_transaction',
        occurredAt: '2026-06-05T10:00:00.000Z',
        workspaceId: 'ws-1',
        userId: 'user-1',
      },
      {
        type: 'weekly_cash_review_completed',
        occurredAt: '2026-06-06T10:00:00.000Z',
        workspaceId: 'ws-1',
        userId: 'user-1',
      },
    ]);

    const result = determineResult({
      fetchState: { ok: true, error: null },
      exportRows: exportState.exportRows,
      invalidRows: exportState.invalidRows,
      activationRows: exportState.activationRows,
      retentionRows: exportState.retentionRows,
      workspaceId: 'ws-1',
      backendUrl: 'https://backend.example.com',
      authContext: { mode: 'bearer', source: 'test', value: 'token', masked: 't***n' },
    });

    expect(result.status).toBe('PASS');
    expect(result.usableEvidence).toBe(true);
  });

  it('blocks when only activation evidence is present', () => {
    const exportState = buildNormalization([
      {
        type: 'activation_first_dashboard_useful',
        occurredAt: '2026-06-05T10:00:00.000Z',
        workspaceId: 'ws-1',
        userId: 'user-1',
      },
    ]);

    const result = determineResult({
      fetchState: { ok: true, error: null },
      exportRows: exportState.exportRows,
      invalidRows: exportState.invalidRows,
      activationRows: exportState.activationRows,
      retentionRows: exportState.retentionRows,
      workspaceId: 'ws-1',
      backendUrl: 'https://backend.example.com',
      authContext: { mode: 'cookie', source: 'test', value: 'cookie=1', masked: 'cookie=***' },
    });

    expect(result.status).toBe('BLOCK');
    expect(result.summary).toContain('SEM EVIDENCIA SUFICIENTE');
    expect(result.usableEvidence).toBe(false);
  });

  it('ignores invalid rows from irrelevant event types', () => {
    const exportState = buildNormalization([
      {
        type: 'activation_first_dashboard_useful',
        occurredAt: '2026-06-05T10:00:00.000Z',
        workspaceId: 'ws-1',
        userId: 'user-1',
      },
      {
        type: 'weekly_cash_review_completed',
        occurredAt: '2026-06-06T10:00:00.000Z',
        workspaceId: 'ws-1',
        userId: 'user-1',
      },
      {
        type: 'transaction_created',
        occurredAt: '2026-06-06T11:00:00.000Z',
        workspaceId: 'ws-1',
      },
    ]);

    expect(exportState.invalidRows).toEqual([]);

    const result = determineResult({
      fetchState: { ok: true, error: null },
      exportRows: exportState.exportRows,
      invalidRows: exportState.invalidRows,
      activationRows: exportState.activationRows,
      retentionRows: exportState.retentionRows,
      workspaceId: 'ws-1',
      backendUrl: 'https://backend.example.com',
      authContext: { mode: 'cookie', source: 'test', value: 'cookie=1', masked: 'cookie=***' },
    });

    expect(result.status).toBe('PASS');
    expect(result.usableEvidence).toBe(true);
  });

  it('resolves explicit login credentials before env aliases', () => {
    const credentials = resolveLoginCredentials({
      email: 'ops@example.com',
      password: 'secret-1',
    });

    expect(credentials.email).toEqual({
      value: 'ops@example.com',
      source: '--email',
    });
    expect(credentials.password).toEqual({
      value: 'secret-1',
      source: '--password',
    });
  });
});
