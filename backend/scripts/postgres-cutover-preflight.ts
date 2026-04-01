import 'dotenv/config';

import { query, testConnection } from '../src/config/database';
import { summarizeCutoverReadiness, type TableCheck } from '../src/utils/postgresCutoverReport';

const EXPECTED_TABLES = [
  'app_state_store',
  'audit_events',
  'workspaces',
  'workspace_users',
  'workspace_user_preferences',
  'workspace_monthly_usage',
  'workspace_usage_events',
  'workspace_billing_hooks',
] as const;

async function checkTable(tableName: string): Promise<TableCheck> {
  const existence = await query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists
  `, [tableName]);

  const exists = Boolean(existence.rows[0]?.exists);
  if (!exists) {
    return { tableName, exists: false, rowCount: null };
  }

  const countResult = await query(`SELECT COUNT(*)::int AS row_count FROM ${tableName}`);
  return {
    tableName,
    exists: true,
    rowCount: Number(countResult.rows[0]?.row_count ?? 0),
  };
}

async function main(): Promise<void> {
  const postgresStateStoreEnabled = String(process.env.POSTGRES_STATE_STORE_ENABLED || '').toLowerCase() === 'true';
  const legacyBlobsDisabled = String(process.env.DISABLE_LEGACY_STATE_BLOBS || '').toLowerCase() === 'true';
  const databaseReachable = await testConnection();

  let expectedTables: TableCheck[] = EXPECTED_TABLES.map((tableName) => ({
    tableName,
    exists: false,
    rowCount: null,
  }));

  if (databaseReachable) {
    expectedTables = [];
    for (const tableName of EXPECTED_TABLES) {
      expectedTables.push(await checkTable(tableName));
    }
  }

  const summary = summarizeCutoverReadiness({
    databaseReachable,
    postgresStateStoreEnabled,
    legacyBlobsDisabled,
    expectedTables,
  });

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    postgresStateStoreEnabled,
    legacyBlobsDisabled,
    databaseReachable,
    expectedTables,
    summary,
  }, null, 2));

  if (summary.status !== 'ready') {
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error('[postgres-cutover-preflight] failed');
  console.error(error);
  process.exit(1);
});
