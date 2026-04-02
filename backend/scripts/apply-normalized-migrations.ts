import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { query, testConnection } from '../src/config/database';
import { DEFAULT_MIGRATIONS_DIR, listNormalizedMigrationFiles } from '../src/utils/postgresMigrationPlan';

type AppliedMigration = {
  name: string;
  applied_at: string;
};

async function ensureSchemaMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function loadAppliedMigrationNames(): Promise<Set<string>> {
  const result = await query('SELECT name, applied_at FROM schema_migrations ORDER BY applied_at ASC');
  return new Set((result.rows as AppliedMigration[]).map((row) => row.name));
}

async function applyMigration(fileName: string): Promise<void> {
  const absolutePath = path.join(DEFAULT_MIGRATIONS_DIR, fileName);
  const sql = await readFile(absolutePath, 'utf8');

  await query('BEGIN');
  try {
    await query(sql);
    await query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [fileName]);
    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  const databaseReachable = await testConnection();
  if (!databaseReachable) {
    throw new Error('Database is not reachable. Check DATABASE_URL or DB_* environment variables before applying migrations.');
  }

  await ensureSchemaMigrationsTable();

  const migrationFiles = await listNormalizedMigrationFiles();
  const appliedMigrationNames = await loadAppliedMigrationNames();

  const appliedNow: string[] = [];
  const alreadyApplied: string[] = [];

  for (const fileName of migrationFiles) {
    if (appliedMigrationNames.has(fileName)) {
      alreadyApplied.push(fileName);
      continue;
    }

    await applyMigration(fileName);
    appliedNow.push(fileName);
  }

  const finalAppliedRows = await query('SELECT name, applied_at FROM schema_migrations ORDER BY applied_at ASC');

  console.log(JSON.stringify({
    status: 'ok',
    migrationsDir: DEFAULT_MIGRATIONS_DIR,
    discoveredMigrations: migrationFiles,
    appliedNow,
    alreadyApplied,
    appliedMigrations: finalAppliedRows.rows,
  }, null, 2));
}

void main().catch((error) => {
  console.error('[apply-normalized-migrations] failed');
  console.error(error);
  process.exit(1);
});
