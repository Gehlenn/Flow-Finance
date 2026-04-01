# Postgres Cutover

## Goal

Move workspace and SaaS state away from legacy JSON/blob storage and run with normalized Postgres tables as the primary persisted store.

## Preconditions

- `POSTGRES_STATE_STORE_ENABLED=true`
- Postgres reachable with the configured backend credentials
- Normalized migrations applied:
  - `001_state_store.sql`
  - `002_workspace_saas_tables.sql`

## Backfill

Run:

```bash
npm run backfill:normalized-state
```

The script:

- initializes the Postgres state store
- hydrates workspace state into normalized tables
- hydrates workspace SaaS usage and billing hooks into normalized tables
- reports the current counts so the operator can validate the cutover

Important:

- run the backfill with `DISABLE_LEGACY_STATE_BLOBS` unset or `false`
- validate the normalized tables before changing runtime behavior

## Cutover

After validating the data in Postgres, enable:

```bash
DISABLE_LEGACY_STATE_BLOBS=true
```

Effect:

- backend stops reading legacy JSON/blob state
- backend stops writing legacy JSON/blob state
- normalized Postgres tables remain active

## Recommended Validation

1. Run `npm run backfill:normalized-state`
2. Verify counts in Postgres for:
   - `workspaces`
   - `workspace_users`
   - `workspace_user_preferences`
   - `workspace_monthly_usage`
   - `workspace_usage_events`
   - `workspace_billing_hooks`
3. Start the backend with `DISABLE_LEGACY_STATE_BLOBS=true`
4. Run:
   - `npm run lint`
   - `npm test`
5. Smoke test:
   - workspace listing
   - tenant selection
   - billing subscription update
   - `/api/admin/audit-logs`
   - `/api/admin/usage-metering`
