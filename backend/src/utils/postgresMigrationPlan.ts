import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

export async function listNormalizedMigrationFiles(migrationsDir = DEFAULT_MIGRATIONS_DIR): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

export function diffMigrations(expected: string[], applied: string[]): {
  pending: string[];
  unexpected: string[];
} {
  const expectedSet = new Set(expected);
  const appliedSet = new Set(applied);

  return {
    pending: expected.filter((migration) => !appliedSet.has(migration)),
    unexpected: applied.filter((migration) => !expectedSet.has(migration)),
  };
}
