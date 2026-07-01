# Flow Finance - security and data hardening review

Data: 2026-06-27
Status: P1 cookie-CSRF gap mitigated; broader offline security slice validated

## Boundary

This review covers the offline code evidence available in this repository for fintech-sensitive surfaces: auth, cookie state changes, CORS, workspace isolation, Firestore rules, AI input security, storage configuration, dependency surface, and secret scanning.

It is not a penetration test, runtime header audit on the published domain, full Firebase emulator pass, or proof that production infrastructure is correctly configured. Those remain `SEM EVIDENCIA SUFICIENTE` unless separately verified.

## Executive Summary

- P0: none found in this offline slice.
- P1 fixed: cookie-authenticated state-changing backend requests were only origin-guarded on `/api/auth/refresh`. A new global cookie-CSRF origin guard now rejects unsafe methods carrying Flow auth cookies unless a trusted `Origin`/`Referer` is present.
- P1 residual: published runtime headers, full emulator-backed Firestore execution, and production infrastructure settings still need live verification before claiming production security readiness.

## Implemented Fix

### S7-001 - Cookie-authenticated state changes needed a broader origin guard

Severity: P1

Evidence before fix:

- `backend/src/services/auth/authCookies.ts` exposes `flow_access_token` and `flow_refresh_token` cookies.
- `backend/src/middleware/auth.ts` accepts access tokens from either `Authorization: Bearer ...` or auth cookies.
- `backend/src/routes/auth.ts` applied `requireTrustedStateChangingOrigin` only to `/api/auth/refresh`.
- Internal state-changing routes such as `backend/src/routes/sync.ts`, `backend/src/routes/saas.ts`, `backend/src/routes/finance.ts`, and `backend/src/routes/workspace.ts` rely on cookie-compatible auth but did not have their own state-changing origin guard.

Change:

- `backend/src/middleware/csrfOrigin.ts` now exports `requireTrustedCookieStateChangingOrigin`.
- `backend/src/index.ts` installs that middleware globally before routes.
- The middleware only applies to unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) when `flow_access_token` or `flow_refresh_token` appears in the Cookie header.
- Bearer-token calls, GET/HEAD/OPTIONS, and webhook/server-to-server calls without Flow auth cookies are not blocked by this new guard.

Evidence after fix:

- `backend/tests/unit/csrf-origin.test.ts` covers:
  - missing origin can be rejected when required
  - cookie + unsafe method + missing trusted origin returns `403`
  - bearer auth without cookie still passes through
  - cookie + configured frontend origin passes
- Focused security/backend suite passed: `7` files, `21` tests.

## Validated Controls

| Area | Status | Evidence | Residual risk |
| --- | --- | --- | --- |
| Express headers/body/CORS/rate limit | Implemented | `backend/src/index.ts`, `backend/src/config/cors.ts`, `backend/src/middleware/rateLimit.ts`, `backend/tests/unit/cors-preflight.test.ts`, `backend/tests/unit/server-config.test.ts` | Runtime headers on Vercel still need live verification. |
| Cookie state-changing CSRF | Implemented after fix | `backend/src/middleware/csrfOrigin.ts`, `backend/src/index.ts`, `backend/tests/unit/csrf-origin.test.ts` | Does not replace a full browser/session abuse test against the published deployment. |
| Auth cookies | Implemented | `backend/src/services/auth/authCookies.ts`, `backend/tests/unit/auth-cookie-middleware.test.ts` | SameSite=None is intentional for cross-origin Vercel frontend/backend and depends on trusted-origin enforcement. |
| Workspace authorization/isolation | Implemented | `backend/src/middleware/authz.ts`, `backend/tests/integration/workspace-authorization.integration.test.ts`, `backend/tests/integration/workspace-storage-isolation.integration.test.ts` | Does not prove every future route uses workspace context correctly. |
| Firestore rule posture | Implemented/static validated | `firestore.rules`, `tests/unit/firestore-rules.static.test.ts`, `tests/firestore/*.test.ts` | Full emulator-backed run was not executed in this slice. |
| AI input security | Implemented | `backend/tests/unit/ai-security-guard.test.ts`, `backend/tests/unit/ai-security-middleware.test.ts` | Prompt-injection behavior in production LLM responses still needs live monitoring. |
| Dependency surface | Implemented for current multer finding | `backend/tests/unit/dependency-surface-security.test.ts`, `docs/SECURITY_MULTER_DEPENDENCY_REVIEW_2026-06-26.md` | This is not a full SCA replacement. |
| Secret scan | Implemented | `scripts/scan-secrets.mjs`; `npm run security:scan-secrets` | Scanner is pattern-based and does not inspect ignored/untracked local secret files. |

## Validation Run

- `vitest run backend/tests/unit/csrf-origin.test.ts backend/tests/unit/cors-preflight.test.ts backend/tests/unit/auth-routes-security.test.ts backend/tests/unit/auth-cookie-middleware.test.ts backend/tests/unit/server-config.test.ts backend/tests/unit/index-bootstrap-observability.test.ts backend/tests/unit/dependency-surface-security.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, 7 files, 21 tests.
- `vitest run tests/unit/firestore-rules.static.test.ts tests/unit/workspace-authz-async.test.ts tests/unit/workspace-scoped-runtime-stores.test.ts backend/tests/integration/workspace-authorization.integration.test.ts backend/tests/integration/workspace-storage-isolation.integration.test.ts backend/tests/unit/ai-security-guard.test.ts backend/tests/unit/ai-security-middleware.test.ts backend/tests/unit/external-integration-auth.test.ts backend/tests/unit/storage-config.test.ts backend/tests/unit/storage-config-observability.test.ts backend/tests/unit/database-config-security.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, 9 files, 81 tests.
- `npm run security:scan-secrets`: `PASS`.
- `tsc -p backend/tsconfig.json --noEmit --pretty false`: `PASS`.
- `npm run type-check:app`: `PASS`.
- `npm run build`: `PASS`.

## Residual Findings

### S7-R1 - Published runtime security headers not verified

Severity: P1 residual before production claim

Evidence: `backend/src/index.ts` uses `helmet()`, and the published backend headers were live-checked on `2026-06-30`. The frontend root still only shows the Vercel/static header baseline plus HSTS even though the worktree `vercel.json` already carries an explicit frontend header policy.

Risk: repo-level Helmet evidence can diverge from deployed edge behavior, and the published frontend can lag behind the repo header policy until redeploy.

Recommended correction: keep the published header audit in the release checklist and redeploy the frontend so the live edge matches the repo header policy.

### S7-R2 - Full Firestore emulator execution not rerun in this slice

Severity: P2

Evidence: `firestore.rules` and related tests exist; this slice used static/unit/integration coverage, not `npm run test:firestore:rules`.

Risk: syntax/static tests do not fully replace emulator semantics.

Recommended correction: rerun Firestore emulator rules before release candidate.

### S7-R3 - Dead prediction files still contain legacy localStorage auth-token assumptions

Severity: P2 if still reachable; P3 cleanup if dead

Evidence: `src/hooks/usePredictions.ts` reads `localStorage.getItem('authToken')`; `src/components/PredictionChart.tsx` imports it; repo search found no app/runtime import of `PredictionChart`.

Risk: if reintroduced, this would revive browser-stored bearer-token behavior that conflicts with the current ephemeral/cookie auth posture.

Recommended correction: remove the dead prediction pair or add an explicit dead-code test/README note before anyone reuses it.

## Decision

Step 7 can move from "dependency partial pass" to `P1 COOKIE-CSRF MITIGATED / OFFLINE SECURITY SLICE PASS`.

Do not mark production security complete until published headers, full Firestore emulator rules, and production infrastructure settings are verified.
