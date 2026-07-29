# Firestore AI usage backfill runbook

Date: 2026-07-29
Status: implemented, dry-run required; `FIRESTORE_AI_USAGE_AUTHORITY_ENABLED` remains disabled

## Decision

The cutover needs a current-UTC-month backfill from the durable Postgres SaaS snapshot into `workspaces/{workspaceId}/saas_usage/{YYYY-MM}`. The backfill writes one aggregate synthetic `aiQueries` event for a non-zero legacy count in the same Firestore transaction as the counter.

This is necessary before a Firestore metering reader excludes legacy AI events for the authoritative month. Without it, the counter would be correct but historical metering could appear as zero for that month.

The synthetic event is not provider-cost evidence. It has no provider, model, token, customer, or user data and must not be used as an invoice input. `metadata.source = legacy_backfill` distinguishes it from live reservations.

## Safety properties

- `npm --prefix backend run backfill:firestore-ai-usage` is a dry run; writes require `-- --apply`.
- It requires `POSTGRES_STATE_STORE_ENABLED=true`, a reachable initialized Postgres store, and a reachable Firestore Admin client.
- It refuses to run while `FIRESTORE_AI_USAGE_AUTHORITY_ENABLED=true`.
- The source counters must be non-negative safe integers. A missing current-month snapshot is an explicit zero snapshot; malformed counters block the run.
- A usage workspace ID present in Postgres but absent from the durable workspace store is reported as `orphanUsageWorkspaceCount` and blocks the run. Orphan usage is never silently omitted.
- Each workspace runs in one Firestore transaction that reads the workspace, monthly usage document, and deterministic event before either write.
- Existing positive usage without its deterministic event, usage with a different `aiQueries` value, malformed authority document, mismatched event, event without its counter, or a source workspace missing from Firestore blocks the run. The tool never overwrites those states. A zero snapshot has no synthetic event by design.
- Apply runs a complete read-only preflight first and performs no writes if it finds a blocker. If a state changes after preflight and becomes a blocker, it stops the remaining applies; a new dry run is required before retrying.
- Immediately before apply, the command reloads the durable workspace and current-month usage source and compares a deterministic in-memory fingerprint. A change aborts apply and reports `sourceChangedBeforeApply: 1`.
- Re-running recognizes an equivalent counter and event and makes no writes.
- Script output contains aggregate counts only; it does not emit workspace IDs, usage values, environment values, credentials, or stack traces.

## Event contract

For non-zero legacy counts, the deterministic event document id is:

`legacy_backfill_ai_queries_{YYYY-MM}`

The transaction writes the normal accepted-event shape so the Firestore metering reader can consume it:

- `userId: "system:legacy-backfill"`
- `resource: "aiQueries"`, aggregate `amount`, `current`, `monthKey`
- `idempotencyKey: "legacy-backfill-aiQueries-{YYYY-MM}"`
- `outcome: "accepted"`, `idempotent: true`
- plan entitlement `limit` and `remaining` captured at backfill time
- `createdAt` at the UTC month start, and `metadata: { "source": "legacy_backfill" }`

No receipt is created, so the synthetic import cannot conflict with a live reservation receipt.

## Operator procedure

1. Keep `FIRESTORE_AI_USAGE_AUTHORITY_ENABLED` unset or `false`.
2. Configure the production-safe Postgres and Firestore Admin identities.
3. Start an explicit quiescence window: stop every writer that can increment legacy `aiQueries`. Keep those writers stopped continuously through dry-run, apply, final dry-run, and authority activation.
4. Run the dry run:

   ```powershell
   npm --prefix backend run backfill:firestore-ai-usage
   ```

5. Proceed only when the JSON output has `status: "ok"`, `conflict: 0`, `invalidLegacyCounters: 0`, and `orphanUsageWorkspaceCount: 0`.
6. Apply. The command reloads and revalidates the durable source before its first write:

   ```powershell
   npm --prefix backend run backfill:firestore-ai-usage -- --apply
   ```

7. Repeat the dry run while writers remain stopped. It should report only `already_backfilled` with no conflicts or source-integrity blockers.
8. Complete the separate emulator, Firestore Rules, metering-reader, and least-privilege identity blockers from [the authority review](2026-07-29-firestore-ai-usage-authority-review.md).
9. If every gate is green, activate `FIRESTORE_AI_USAGE_AUTHORITY_ENABLED` immediately after the final dry run, then resume requests through the authoritative path. If activation cannot be immediate, keep writers quiesced and repeat the final dry run before activation.

## Remaining risk

The source is a monthly aggregate, not a replayable event stream. This preserves count continuity only. It cannot reconstruct request timestamps, users, provider/model details, tokens, or cost. Any counter conflict is intentionally an operational investigation, not an automatic merge decision.

There is no global database lock and no legacy-to-Firestore dual-write in this tool. The pre-apply reload detects changes between its two source reads, but a writer could still increment legacy usage after that comparison. The continuous quiescence window is therefore a mandatory operational control, not an optional optimization.
