> Status: adiado. O caminho principal atual do Flow Finance usa Firestore como banco operacional para tenancy, workspaces, membership, audit log e entidades financeiras. Este documento fica apenas como referencia futura de exploracao.

# Postgres Cutover

## Goal

Move workspace and SaaS state away from legacy JSON/blob storage and run with normalized Postgres tables as the primary persisted store.

## Preconditions

- `POSTGRES_STATE_STORE_ENABLED=true`
- Postgres reachable with the configured backend credentials
- Normalized migrations applied:
  - `001_state_store.sql`
  - `002_workspace_saas_tables.sql`
  - `003_multi_tenant_audit.sql`

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
- `tenants`
- `workspaces`
- `workspace_users`
- `workspace_user_preferences`
- `workspace_monthly_usage`
- `workspace_usage_events`
- `workspace_billing_hooks`

## Backfill

Run:

```bash
POSTGRES_STATE_STORE_ENABLED=true npm run backfill:normalized-state
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

After validating the normalized row counts and application smoke tests, enable:

```bash
DISABLE_LEGACY_STATE_BLOBS=true
```

Effect:

- backend stops reading legacy JSON/blob state
- backend stops writing legacy JSON/blob state
- normalized Postgres tables remain active

## Recommended sequence

1. `npm run preflight:cutover`
2. Fix connectivity or missing tables if the report is blocked
3. `POSTGRES_STATE_STORE_ENABLED=true npm run backfill:normalized-state`
4. Re-run `npm run preflight:cutover`
5. Enable `DISABLE_LEGACY_STATE_BLOBS=true`
6. Run `npm run lint` and `npm test`
7. Smoke test workspace listing, tenant selection, billing updates, audit logs, and usage metering
