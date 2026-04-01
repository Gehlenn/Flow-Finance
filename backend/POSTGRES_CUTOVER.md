# Postgres Cutover

## Preflight

Run the readiness check before any backfill:

```bash
npm run preflight:cutover
```

The script reports:

- whether PostgreSQL is reachable
- whether `POSTGRES_STATE_STORE_ENABLED` is enabled
- whether `DISABLE_LEGACY_STATE_BLOBS` is already enabled
- whether the normalized state tables exist
- current row counts for each expected table
- a final readiness status and recommendations

Expected normalized tables:

- `app_state_store`
- `audit_events`
- `workspaces`
- `workspace_users`
- `workspace_user_preferences`
- `workspace_monthly_usage`
- `workspace_usage_events`
- `workspace_billing_hooks`

## Backfill

After the preflight is green enough for execution:

```bash
POSTGRES_STATE_STORE_ENABLED=true npm run backfill:normalized-state
```

## Cutover

After validating the normalized row counts and application smoke tests:

```bash
DISABLE_LEGACY_STATE_BLOBS=true
```

## Recommended sequence

1. `npm run preflight:cutover`
2. Fix connectivity or missing tables if the report is blocked
3. `POSTGRES_STATE_STORE_ENABLED=true npm run backfill:normalized-state`
4. Re-run `npm run preflight:cutover`
5. Enable `DISABLE_LEGACY_STATE_BLOBS=true`
6. Run `npm run lint` and `npm test`
