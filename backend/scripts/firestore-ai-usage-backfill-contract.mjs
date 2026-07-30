export const FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT = Object.freeze({
  defaultMode: 'dry-run',
  applyFlag: '--apply',
  requiresExplicitApply: true,
});

export function parseFirestoreAiUsageBackfillMode(args) {
  if (args.length === 0) {
    return FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT.defaultMode;
  }

  if (args.length === 1 && args[0] === FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT.applyFlag) {
    return 'apply';
  }

  throw new Error(`Usage: npm run backfill:firestore-ai-usage -- [${FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT.applyFlag}]`);
}
