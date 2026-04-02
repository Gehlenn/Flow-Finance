import 'dotenv/config';

import { query, testConnection } from '../src/config/database';
import { listNormalizedMigrationFiles, diffMigrations } from '../src/utils/postgresMigrationPlan';
import { summarizeCutoverReadiness, type TableCheck } from '../src/utils/postgresCutoverReport';

const EXPECTED_TABLES = [
  'app_state_store',
  'audit_events',
  'tenants',
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

async function loadAppliedMigrations(): Promise<string[]> {
  const existsResult = await query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    ) AS exists
  `);

  if (!Boolean(existsResult.rows[0]?.exists)) {
    return [];
  }

  const result = await query('SELECT name FROM schema_migrations ORDER BY applied_at ASC, name ASC');
  return result.rows.map((row: Record<string, unknown>) => String(row.name));
}

async function main(): Promise<void> {
  const postgresStateStoreEnabled = String(process.env.POSTGRES_STATE_STORE_ENABLED || '').toLowerCase() === 'true';
  const legacyBlobsDisabled = String(process.env.DISABLE_LEGACY_STATE_BLOBS || '').toLowerCase() === 'true';
  const databaseReachable = await testConnection();
  const expectedMigrationFiles = await listNormalizedMigrationFiles();

  let expectedTables: TableCheck[] = EXPECTED_TABLES.map((tableName) => ({
    tableName,
    exists: false,
    rowCount: null,
  }));
  let appliedMigrations: string[] = [];
  let pendingMigrations = [...expectedMigrationFiles];
  let unexpectedMigrations: string[] = [];

  if (databaseReachable) {
    expectedTables = [];
    for (const tableName of EXPECTED_TABLES) {
      expectedTables.push(await checkTable(tableName));
    }

    appliedMigrations = await loadAppliedMigrations();
    const migrationDiff = diffMigrations(expectedMigrationFiles, appliedMigrations);
    pendingMigrations = migrationDiff.pending;
    unexpectedMigrations = migrationDiff.unexpected;
  }

  const summary = summarizeCutoverReadiness({
    databaseReachable,
    postgresStateStoreEnabled,
    legacyBlobsDisabled,
    expectedTables,
  });

  const recommendations = [...summary.recommendations];
  if (databaseReachable && pendingMigrations.length > 0) {
    recommendations.push(`Run apply-normalized-migrations before cutover. Pending migrations: ${pendingMigrations.join(', ')}.`);
  }
  if (unexpectedMigrations.length > 0) {
    recommendations.push(`Review unexpected applied migrations in schema_migrations: ${unexpectedMigrations.join(', ')}.`);
  }

  const finalStatus = summary.status === 'ready' && pendingMigrations.length === 0 ? 'ready' : 'blocked';

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    postgresStateStoreEnabled,
    legacyBlobsDisabled,
    databaseReachable,
    expectedMigrationFiles,
    appliedMigrations,
    pendingMigrations,
    unexpectedMigrations,
    expectedTables,
    summary: {
      ...summary,
      status: finalStatus,
      recommendations,
    },
  }, null, 2));

  if (finalStatus !== 'ready') {
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error('[postgres-cutover-preflight] failed');
  console.error(error);
  process.exit(1);
});
