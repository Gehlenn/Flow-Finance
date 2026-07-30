# Track 07 - Legacy, deprecation, compatibility and fallbacks

Date: 2026-07-27
Scope: remove only obsolete legacy, compatibility, deprecated, or fallback paths supported by high-confidence evidence.

> Final integration note: the same reachability standard used for the receipt
> wrapper was applied to the parallel `src/engines/importacao` subsystem.
> `extratoImporter`, `ocrRecibo`, `pdfExtrato`, their co-located tests, the
> external PDF date test, and `pdf-parse` were removed after confirming that
> live imports use `src/finance/importService.ts` and
> `src/ai/receiptScanner.ts`.

> Follow-up on 2026-07-29: an orphan backend AI factory/orchestrator/provider
> stack and its dedicated tests were removed after confirming that production
> uses `backend/src/config/ai.ts`. Two unconsumed usage-authority aliases and a
> nonexistent `FF_AI_FALLBACK` comment entry were also removed. Active provider
> failover and quota persistence compatibility remain pending explicit runtime
> contracts. See
> [AI runtime and quota follow-up](./2026-07-29-ai-runtime-and-quota-follow-up.md).

## Executive assessment

The repository contains many occurrences of `legacy`, `deprecated`, `compatibility`, and `fallback`, but most are not dead code. Several are active operational contracts: provider failover, offline/local-first behavior, persistence migration, authentication compatibility, observability, imports, security controls, and external integrations.

Three removals were supported by high-confidence evidence:

1. A receipt OCR compatibility wrapper had no runtime consumers and duplicated the canonical scanner.
2. Two AI feature-flag aliases were declared but never read; the canonical flags already covered the behavior.
3. Open Finance had a duplicate and incorrectly mounted feature gate in `backend/src/index.ts`; the banking router already owns the gate in the correct order.

No persistence, provider, authentication, clinic-integration, import, security, or observability fallback was removed.

## Method and baseline

The assessment combined:

- static searches for legacy/deprecation/fallback/compatibility vocabulary;
- import and call-site searches;
- package-export and runtime-route review;
- Knip file reachability;
- feature-flag definitions and consumers;
- OpenAPI, migration runbooks, tests, and canonical product/planning documents;
- focused tests, TypeScript checks, and dependency-cycle checks.

The shared initial triage reported approximately 20 `legacy`, 3 `deprecated`, 471 `fallback`, and 17 `compat` occurrences. These textual counts changed while eight tracks edited the shared worktree concurrently. A later exact-word snapshot produced 21 `legacy`, 3 `deprecated`, 481 `fallback`, and 5 `compatibility` occurrences; stem-based searches produced 42, 3, 551, and 16 respectively.

These counts are discovery aids, not a deletion metric. A legitimate recovery contract can account for many occurrences, while an obsolete wrapper may account for only one.

## Inventory by category and evidence

| Category | Evidence | Decision |
|---|---|---|
| Receipt OCR compatibility wrapper | `src/services/importacao/ocrRecibo.ts` was imported only by its own unit test. Runtime UI uses `src/ai/receiptScanner.ts`. Knip found no remaining unused file after deletion. | Removed |
| AI feature-flag aliases | `ai_analysis_enabled` and `ai_fallback_enabled` existed only as default definitions/aliases. No runtime read was found. Canonical flags are `ai_deep_analysis_enabled` and `ai_provider_fallback_enabled`. | Removed |
| Open Finance route gate duplication | `backend/src/index.ts` passed the gate factory directly to `app.use`, while `backend/src/routes/banking.ts` already invokes `featureGateOpenFinance()` after public health and webhook routes. | Removed from outer mount; retained in router |
| Deprecated clinic financial-events endpoint | Route emits `Deprecation`, `Sunset`, and successor `Link` headers; OpenAPI marks the endpoint deprecated; planning identifies it as a compatibility adapter until migration. | Retained |
| Legacy authentication helpers/routes | Login/refresh and token compatibility are externally visible authentication behavior. Removal requires client and contract migration evidence. | Retained |
| `GEMINI_MODEL` environment compatibility | Read by active Gemini configuration and supplied through deployment/runtime configuration. | Retained |
| AI provider fallback | Canonical feature flag and provider initialization implement resilience between configured providers. | Retained |
| Legacy state blobs and JSON/file persistence | `backend/POSTGRES_CUTOVER.md`, cutover scripts, backfill tooling, feature switches, and tests explicitly define a staged Postgres migration. | Retained |
| Firebase banking migration | Migration route and related documentation/tests represent an explicit data-transition contract. | Retained |
| Offline/local-first behavior | Product architecture treats local persistence and synchronization as first-class behavior, not obsolete recovery code. | Retained |
| Import fallbacks | File-format and data-normalization paths handle untrusted/external input. | Retained |
| Observability and security fallbacks | Error reporting, safe operational defaults, kill switches, and authentication checks have specific failure-handling roles. | Retained |
| Unused exported helpers reported by Knip | Examples include the backwards-compatible auth token helper and specialized feature-gate exports. Static non-use is insufficient proof against external/dynamic consumers. | Deferred for contract audit |

## Implemented removals

### 1. Removed the unused receipt OCR wrapper

Deleted:

- `src/services/importacao/ocrRecibo.ts`
- `tests/unit/importacao/ocrRecibo.test.ts`

The wrapper translated the canonical scanner response into a second Portuguese-shaped contract. It had no production importer, no package export, and no documentation consumer. Receipt scanning remains implemented and tested through `src/ai/receiptScanner.ts`.

### 2. Consolidated AI feature-flag names

Changed:

- `backend/src/services/featureFlags/EnhancedFeatureFlagService.ts`
- `backend/src/config/featureFlags.ts`
- `backend/tests/unit/enhanced-feature-flags.test.ts`

Removed aliases:

- `ai_analysis_enabled`
- `ai_fallback_enabled`

Retained canonical names:

- `ai_deep_analysis_enabled`
- `ai_provider_fallback_enabled`

The default-service test now asserts that canonical flags exist and aliases do not.

### 3. Made the Open Finance gate singular

Changed:

- `backend/src/index.ts`
- `backend/tests/unit/index-bootstrap-observability.test.ts`
- added `backend/tests/unit/banking-route-gate-placement.test.ts`

The outer application mount now mounts `bankingRoutes` directly. The banking router remains the single owner of `featureGateOpenFinance()`, after:

1. `GET /health`
2. `POST /webhooks/pluggy`
3. authentication/workspace context

This preserves operational health and provider webhook access while gating authenticated Open Finance functionality. The stale bootstrap mock for the removed outer dependency was also deleted.

## Contracts deliberately preserved

### Clinic compatibility

`/api/integrations/clinic/financial-events` is deprecated, not dead. It advertises:

- `Deprecation: true`
- `Sunset: Wed, 30 Sep 2026 23:59:59 GMT`
- a successor link to `/api/integrations/clinic/webhook`

Removal before the sunset/migration evidence would break an explicit external contract.

### Persistence transition

`DISABLE_LEGACY_STATE_BLOBS`, backfill scripts, normalized-state checks, and JSON/file adapters are part of the documented Postgres cutover. The runbook explicitly requires the legacy path during backfill and smoke validation. These paths must be retired through the cutover protocol, not a textual cleanup.

### Provider and runtime resilience

Gemini/OpenAI provider selection, canonical provider fallback flags, environment-name compatibility, local-first storage, import normalization, and observability recovery paths all have identified runtime roles. They were not treated as obsolete merely because they contain fallback vocabulary.

## Validation

### Focused tests

Baseline before implementation:

```text
4 files passed
34 tests passed
```

Post-change core set:

```text
5 files passed
36 tests passed
```

The set covered:

- banking gate placement;
- enhanced feature flags;
- feature-gate middleware;
- app-level feature-gate behavior;
- canonical receipt scanner.

Bootstrap observability was then run independently:

```text
1 file passed
3 tests passed
```

One combined run under concurrent workspace load hit the original five-second timeout in the bootstrap test and consequently observed a duplicate mock call in the next test. Re-running the same bootstrap file independently with a 15-second timeout passed all three tests. This is recorded as execution-environment contention, not hidden as a clean aggregate run.

### Type checks

```text
npm run type-check:app      PASS
npm run type-check:backend  PASS
```

### Circular dependencies

```text
Madge app:     286 files processed, 0 circular dependencies
Madge backend: 159 files processed, 0 circular dependencies
```

### Unused files

```text
knip --include files: PASS, no unused files reported
```

Knip still reports unused exports in the broader export analysis. They were not removed in this track because export non-use alone does not prove that auth, middleware, or external API compatibility is obsolete.

## Critical recommendations

1. Remove the clinic compatibility endpoint only after the published sunset date and after integration telemetry or consumer confirmation proves no remaining traffic.
2. Complete the documented Postgres cutover before removing legacy blobs or file/JSON persistence.
3. Audit Knip's unused exports by boundary: internal-only exports can be narrowed; public/auth/integration exports need explicit contract evidence.
4. Keep feature aliases out of default definitions. If a future rename requires migration, implement one documented translation boundary with an expiry condition.
5. Keep route gates owned by the narrowest router that understands public versus protected endpoints.
6. Treat fallback removal as a behavior migration with failure-mode tests, not as keyword deletion.

## Risks and limits

- The worktree was shared with seven other cleanup tracks, so global keyword counts and aggregate execution timing were moving targets.
- Static analysis cannot prove absence of externally constructed imports or consumers outside this repository.
- No full repository test suite was claimed for this track; focused behavior, both TypeScript projects, Knip file reachability, and both Madge graphs were validated.
- Retained compatibility paths need owners and explicit retirement conditions to avoid becoming permanent by accident.
