# Published infra and billing boundary check - 2026-06-30

Status: PUBLIC RUNTIME PASS FOR HEADERS / BILLING REAL SMOKE STILL UNPROVEN

## Scope

This check covers public, unauthenticated runtime evidence only. It does not read `.env` files, does not print secrets, does not create a Stripe checkout, and does not use a real customer session.

## Evidence used

- Published frontend aliases documented in `README.md` and `docs/DEPLOYMENT_STATUS.md`: `https://flow-finance-frontend-nine.vercel.app/` and `https://flow-finance-xi.vercel.app/`.
- Published backend alias documented in `README.md` and `docs/DEPLOYMENT_STATUS.md`: `https://flow-finance-backend.vercel.app/`.
- Backend security middleware: `backend/src/index.ts:87` uses `helmet()` and `backend/src/index.ts:94-99` applies the project CORS options.
- Stripe webhook and billing route boundaries: `backend/src/routes/saas.ts:75-80`, `backend/src/routes/saas.ts:175-177`, `backend/src/routes/saas.ts:217-236`.
- Frontend edge header config added in `vercel.json`.
- Vercel deploy evidence: official frontend deployment `dpl_3YmbPgVcFhxv8HnmsMx6cFEPRDSi` promoted `https://flow-finance-frontend-nine.vercel.app`.
- Vercel deploy evidence: alternate frontend deployment `dpl_5qgv5j99TUAGBMbUncPavkvnAwU8` promoted `https://flow-finance-xi.vercel.app`.
- Vercel deploy evidence: official frontend deployment `dpl_YZc7iFsJtcBp3AX9Vky3N2eitwfV` promoted script CSP hardening to `https://flow-finance-frontend-nine.vercel.app`.
- Vercel deploy evidence: alternate frontend deployment `dpl_6r3DVKQsgVUVgQFBsFykko8W3oXu` promoted script CSP hardening to `https://flow-finance-xi.vercel.app`.
- Vercel deploy evidence: official frontend deployment `dpl_GVoQNYWMFMAMtWHTJMBtjda9defc` removed runtime inline handlers and promoted to `https://flow-finance-frontend-nine.vercel.app`.
- Vercel deploy evidence: alternate frontend deployment `dpl_Bv1wu9QbSyqez2qm4hSqCfjuCAtL` removed runtime inline handlers and promoted to `https://flow-finance-xi.vercel.app`.
- Vercel deploy evidence: official frontend deployment `dpl_3aMx98ErwTseg6TDbhRJgYnsMdFs` removed frontend `style-src 'unsafe-inline'` and promoted to `https://flow-finance-frontend-nine.vercel.app`.
- Vercel deploy evidence: alternate frontend deployment `dpl_FjwvsZVfZDKESRS38rt7g2Hr5ZQo` removed frontend `style-src 'unsafe-inline'` and promoted to `https://flow-finance-xi.vercel.app`.

## Public runtime observations

### Frontend aliases

Command:

```powershell
curl.exe -sS -D - -o NUL https://flow-finance-frontend-nine.vercel.app/
curl.exe -sS -D - -o NUL https://flow-finance-xi.vercel.app/
```

Observed on 2026-06-30:

- `200 OK` on both aliases.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- `Access-Control-Allow-Origin: *` was visible on the static HTML response.
- `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` were not visible on the currently published static HTML response.

Correction made and published:

- `vercel.json` now sets frontend-wide `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- `vercel.json` now uses `rewrites` instead of legacy `routes`, so Vercel applies the top-level headers to the SPA shell.
- `.vercelignore` now excludes local artifacts such as `.tmp`, `node_modules`, `dist`, screenshots, test results, and logs from deployment uploads.
- Local validation: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"` returned `vercel.json OK`.
- Local validation: `npm run build` passed after the frontend edge header change.
- Local validation: `npm run type-check:app` passed after the frontend edge header change.
- Published validation: `npm run health:published-headers` passed in strict mode for `https://flow-finance-frontend-nine.vercel.app`, with artifact `test-results/published-headers/2026-06-30T22-39-12-012Z.json`.
- Published validation: `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers` passed in strict mode for the alternate frontend, with artifact `test-results/published-headers/2026-06-30T22-39-12-189Z.json`.
- Published validation: `npm run health:published-headers` passed after script CSP hardening, with artifact `test-results/published-headers/2026-07-01T12-47-26-231Z.json`; frontend CSP reported no `script-src` violation.
- Published validation: `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers` passed after script CSP hardening, with artifact `test-results/published-headers/2026-07-01T12-48-04-023Z.json`; alternate frontend CSP reported no `script-src` violation.
- Published validation: `npm run health:published-headers` passed after removing runtime inline handlers, with artifact `test-results/published-headers/2026-07-01T12-57-27-553Z.json`.
- Published validation: `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers` passed after removing runtime inline handlers, with artifact `test-results/published-headers/2026-07-01T12-57-27-739Z.json`.
- Local CSP readiness: `npm run health:csp-readiness` produced `test-results/csp-readiness/2026-07-01T18-03-23-764Z.json` with `PASS`, `scriptBlockers: []`, `styleBlockers: []`, `scriptCspReady: true`, and `styleCspReady: true`.
- Published validation: `npm run health:published-headers` passed after style CSP hardening, with artifact `test-results/published-headers/2026-07-01T18-06-58-946Z.json`; frontend CSP reported no `script-src` or `style-src` violation.
- Published validation: `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers` passed after style CSP hardening, with artifact `test-results/published-headers/2026-07-01T18-07-00-337Z.json`; alternate frontend CSP reported no `script-src` or `style-src` violation.
- Published validation: `npm run health:vercel` passed against `https://flow-finance-backend.vercel.app`; `/health`, `/api/health`, and `/api/version` matched the expected contracts and `/` returned the expected API-only `404`.

Important boundary:

- The published header fix is evidenced for the official and alternate frontend aliases. This still does not prove authenticated app flows, real checkout, real user trust, or commercial conversion.

### Backend health and version

Command:

```powershell
curl.exe -sS -D - https://flow-finance-backend.vercel.app/api/health
curl.exe -sS -D - https://flow-finance-backend.vercel.app/api/version
```

Observed on 2026-06-30:

- `/api/health` returned `200 OK`, `service=flow-finance-api`, `version=0.9.7`.
- `/api/version` returned `200 OK`, `version=0.9.7`, `environment=production`.
- Health response reported `workspacePersistence.mode=firebase`, `durable=true`, `configured=true`, `required=true`, `status=healthy`.
- Health response reported `domainEventPersistence.mode=firebase`, `durable=true`, `configured=true`, `required=true`, `status=healthy`.
- Backend response headers included `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Cross-Origin-Opener-Policy`.

Assessment:

- Backend published health and security-header posture is public-runtime evidenced for this unauthenticated slice.
- This does not prove authenticated business workflows, billing reconciliation, or real customer behavior.

### SaaS and Stripe unauthenticated boundaries

Commands:

```powershell
curl.exe -sS -D - https://flow-finance-backend.vercel.app/api/saas/plans
curl.exe -sS -D - -H 'Content-Type: application/json' -X POST https://flow-finance-backend.vercel.app/api/saas/stripe/webhook --data '{}'
```

Observed on 2026-06-30:

- `GET /api/saas/plans` returned `401 Unauthorized` with `Missing authentication token`.
- `POST /api/saas/stripe/webhook` without a valid Stripe signature returned `401 Unauthorized` with `Invalid Stripe webhook signature`.
- `OPTIONS /api/saas/stripe/checkout-session` from `https://flow-finance-frontend-nine.vercel.app` returned `204 No Content` and allowed that origin.
- `OPTIONS /api/saas/stripe/checkout-session` from `https://evil.example` did not return a permissive CORS preflight response.
- `POST /api/saas/stripe/checkout-session` and `POST /api/saas/stripe/portal-session` with syntactically valid JSON but no auth returned `401 Unauthorized`.
- `npm run health:published-headers` confirmed backend `health` and root checks passed in strict mode, including required security headers.

Assessment:

- Public unauthenticated access does not expose billing catalog, checkout creation, portal creation, or webhook ingestion.
- The route code confirms authz on plan, checkout, and portal endpoints and signature verification before webhook processing.

## Findings

### P1 - Frontend static app lacked visible security headers in the published response - CLOSED

- Previous evidence: public response from both frontend aliases had HSTS but did not show CSP, frame, nosniff, referrer, or permissions headers.
- Evidence: previous `vercel.json` only configured cache headers for `/index.html` and CSS assets.
- Closure evidence: `npm run health:published-headers` now passes for the official frontend, and the same runner passes with `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app` for the alternate frontend.
- Impact comercial: weakens trust posture for a fintech-like SaaS and leaves production-readiness claims too broad.
- Impact tecnico: missing defense-in-depth against XSS/clickjacking/content sniffing on the browser app shell.
- Correction: `vercel.json` now defines frontend-wide security headers and uses `rewrites` instead of legacy `routes`.
- Remaining risk: authenticated app behavior under strict CSP still needs real-use validation.

### P2 - Style CSP was intentionally compatible, not strict - CLOSED FOR PUBLISHED HEADER

- Evidence: `index.html` no longer uses inline importmap/bootstrap; `public/flow-bootstrap.js` carries the service-worker bootstrap; runtime guards, progress surfaces, dev panels, logo animation, and Vercel CSP were migrated away from inline style/script surfaces.
- Closure evidence: `test-results/csp-readiness/2026-07-01T18-03-23-764Z.json` is `PASS`, and `test-results/published-headers/2026-07-01T18-06-58-946Z.json` plus `test-results/published-headers/2026-07-01T18-07-00-337Z.json` show no frontend `script-src` or `style-src` violations.
- Impact comercial: acceptable as an incremental hardening step, but not strong enough to market as mature browser security.
- Impact tecnico: XSS defense-in-depth is improved but not maximized.
- Remaining risk: this proves headers and static/runtime inventory, not authenticated workflow behavior under real usage.

### P1 - Stripe/env alignment remains unproven without authenticated billing smoke

- Evidence: unauthenticated public checks only prove route boundaries and webhook rejection without signature.
- SEM EVIDENCIA SUFICIENTE: current published values for `SAAS_PRO_MONTHLY_PRICE_CENTS`, `STRIPE_PRICE_PRO_MONTHLY`, webhook secret alignment, portal customer state, paid checkout completion, and workspace plan reconciliation.
- Impact comercial: cannot honestly claim paid conversion or billing readiness from this check alone.
- Correction recommended: after deploy and when app testing resumes, run the authenticated Stripe smoke with a controlled workspace and save the artifact.

## Verdict

The backend published slice remains healthy: health, Firebase persistence status, CORS boundary, rate limiting headers, Helmet headers, authz-protected SaaS routes, and Stripe webhook signature rejection all have public evidence.

The frontend published shell header gap is now closed on both official aliases. The remaining production gap is no longer basic browser headers; it is authenticated billing/env proof and real-use evidence.
