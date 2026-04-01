export type TableCheck = {
  tableName: string;
  exists: boolean;
  rowCount: number | null;
};

export type CutoverReadiness = {
  databaseReachable: boolean;
  postgresStateStoreEnabled: boolean;
  legacyBlobsDisabled: boolean;
  expectedTables: TableCheck[];
};

export function summarizeCutoverReadiness(input: CutoverReadiness): {
  status: 'ready' | 'blocked';
  missingTables: string[];
  populatedTables: string[];
  recommendations: string[];
} {
  const missingTables = input.expectedTables
    .filter((table) => !table.exists)
    .map((table) => table.tableName);

  const populatedTables = input.expectedTables
    .filter((table) => table.exists && typeof table.rowCount === 'number' && table.rowCount > 0)
    .map((table) => table.tableName);

  const recommendations: string[] = [];

  if (!input.postgresStateStoreEnabled) {
    recommendations.push('Enable POSTGRES_STATE_STORE_ENABLED=true before cutover validation.');
  }

  if (!input.databaseReachable) {
    recommendations.push('Restore PostgreSQL connectivity before attempting backfill or cutover.');
  }

  if (missingTables.length > 0) {
    recommendations.push(`Apply the normalized state migrations for: ${missingTables.join(', ')}.`);
  }

  if (input.legacyBlobsDisabled && (!input.databaseReachable || missingTables.length > 0)) {
    recommendations.push('Do not enable DISABLE_LEGACY_STATE_BLOBS=true until Postgres is reachable and all normalized tables exist.');
  }

  if (input.databaseReachable && missingTables.length === 0 && !input.legacyBlobsDisabled) {
    recommendations.push('Run the normalized-state backfill, validate row counts, then enable DISABLE_LEGACY_STATE_BLOBS=true.');
  }

  return {
    status: input.databaseReachable && input.postgresStateStoreEnabled && missingTables.length === 0 ? 'ready' : 'blocked',
    missingTables,
    populatedTables,
    recommendations,
  };
}
