export type FirestoreAiUsageBackfillMode = 'dry-run' | 'apply';

export declare const FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT: Readonly<{
  defaultMode: 'dry-run';
  applyFlag: '--apply';
  requiresExplicitApply: true;
}>;

export declare function parseFirestoreAiUsageBackfillMode(args: string[]): FirestoreAiUsageBackfillMode;
