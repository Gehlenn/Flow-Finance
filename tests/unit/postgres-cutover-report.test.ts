import { describe, expect, it } from 'vitest';
import { summarizeCutoverReadiness } from '../../backend/src/utils/postgresCutoverReport';

describe('postgres cutover report', () => {
  it('marks readiness as blocked when Postgres is unreachable and tables are missing', () => {
    const result = summarizeCutoverReadiness({
      databaseReachable: false,
      postgresStateStoreEnabled: true,
      legacyBlobsDisabled: false,
      expectedTables: [
        { tableName: 'workspaces', exists: false, rowCount: null },
        { tableName: 'workspace_users', exists: true, rowCount: 4 },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.missingTables).toEqual(['workspaces']);
    expect(result.recommendations.join(' ')).toContain('Restore PostgreSQL connectivity');
  });

  it('marks readiness as ready when Postgres is reachable and all normalized tables exist', () => {
    const result = summarizeCutoverReadiness({
      databaseReachable: true,
      postgresStateStoreEnabled: true,
      legacyBlobsDisabled: false,
      expectedTables: [
        { tableName: 'workspaces', exists: true, rowCount: 2 },
        { tableName: 'workspace_users', exists: true, rowCount: 3 },
      ],
    });

    expect(result.status).toBe('ready');
    expect(result.missingTables).toEqual([]);
    expect(result.populatedTables).toEqual(['workspaces', 'workspace_users']);
    expect(result.recommendations.join(' ')).toContain('Run the normalized-state backfill');
  });
});
