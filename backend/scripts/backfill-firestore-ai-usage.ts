import 'dotenv/config';

import {
  initializePostgresStateStore,
  isPostgresStateStoreEnabled,
  loadWorkspaceSaasState,
  loadWorkspaceStoreState,
} from '../src/services/persistence/postgresStateStore';
import { getFirestoreOrNull } from '../src/utils/firestoreAdmin';
import {
  applyFirestoreAiUsageBackfill,
  inspectFirestoreAiUsageBackfill,
  prepareLegacyAiUsageBackfillSource,
  utcMonthKey,
  type BackfillAction,
} from '../src/services/usage/firestoreAiUsageBackfill';

type BackfillMode = 'dry-run' | 'apply';

function parseMode(args: string[]): BackfillMode {
  if (args.length === 0) return 'dry-run';
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  throw new Error('Usage: npm run backfill:firestore-ai-usage -- [--apply]');
}

function emptyCounts(): Record<BackfillAction, number> {
  return {
    create_snapshot_and_event: 0,
    create_snapshot: 0,
    already_backfilled: 0,
    skipped_missing_workspace: 0,
    conflict: 0,
  };
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (process.env.FIRESTORE_AI_USAGE_AUTHORITY_ENABLED === 'true') {
    throw new Error('Refusing to run while FIRESTORE_AI_USAGE_AUTHORITY_ENABLED=true');
  }
  if (!isPostgresStateStoreEnabled()) {
    throw new Error('POSTGRES_STATE_STORE_ENABLED=true is required so the legacy source is durable');
  }
  if (!await initializePostgresStateStore()) {
    throw new Error('Postgres state store could not be initialized');
  }

  const db = await getFirestoreOrNull('FirestoreAiUsageBackfill');
  if (!db) {
    throw new Error('Firestore is not configured or reachable');
  }

  const monthKey = utcMonthKey();
  const [workspaceState, saasState] = await Promise.all([
    loadWorkspaceStoreState(),
    loadWorkspaceSaasState(),
  ]);
  const source = prepareLegacyAiUsageBackfillSource(
    workspaceState?.workspaces.map((workspace) => workspace.workspaceId) ?? [],
    saasState?.usageByWorkspace ?? {},
    monthKey,
  );

  const counts = emptyCounts();
  for (const input of source.inputs) {
    const result = await inspectFirestoreAiUsageBackfill(db, { ...input, monthKey });
    counts[result.action] += 1;
  }

  const blockedBeforeApply = counts.conflict + counts.skipped_missing_workspace +
    source.invalidLegacyCounters + source.orphanUsageWorkspaceCount;
  let sourceChangedBeforeApply = 0;
  if (mode === 'apply' && blockedBeforeApply === 0) {
    const [refreshedWorkspaceState, refreshedSaasState] = await Promise.all([
      loadWorkspaceStoreState(),
      loadWorkspaceSaasState(),
    ]);
    const refreshedSource = prepareLegacyAiUsageBackfillSource(
      refreshedWorkspaceState?.workspaces.map((workspace) => workspace.workspaceId) ?? [],
      refreshedSaasState?.usageByWorkspace ?? {},
      monthKey,
    );

    if (refreshedSource.fingerprint !== source.fingerprint) {
      sourceChangedBeforeApply = 1;
    } else {
      const appliedCounts = emptyCounts();
      for (const input of refreshedSource.inputs) {
        const result = await applyFirestoreAiUsageBackfill(db, { ...input, monthKey });
        appliedCounts[result.action] += 1;
        // There is no global lock. Stop after the first state that changed
        // between preflight and its transaction, then require a new dry run.
        if (result.action === 'conflict' || result.action === 'skipped_missing_workspace') break;
      }
      Object.assign(counts, appliedCounts);
    }
  }

  const blocked = counts.conflict + counts.skipped_missing_workspace + source.invalidLegacyCounters +
    source.orphanUsageWorkspaceCount + sourceChangedBeforeApply;
  process.stdout.write(`${JSON.stringify({
    status: blocked === 0 ? 'ok' : 'blocked',
    mode,
    monthKey,
    workspaceCount: source.workspaceCount,
    orphanUsageWorkspaceCount: source.orphanUsageWorkspaceCount,
    invalidLegacyCounters: source.invalidLegacyCounters,
    sourceChangedBeforeApply,
    counts,
    nextStep: mode === 'dry-run'
      ? 'Review the aggregate result, then rerun with --apply only when blocked is zero.'
      : 'Keep FIRESTORE_AI_USAGE_AUTHORITY_ENABLED disabled until every activation blocker is independently verified.',
  }, null, 2)}\n`);

  if (blocked > 0) {
    process.exitCode = 1;
  }
}

void main().catch(() => {
  process.stderr.write('[backfill-firestore-ai-usage] failed; rerun the dry run before any retry\n');
  process.exit(1);
});
