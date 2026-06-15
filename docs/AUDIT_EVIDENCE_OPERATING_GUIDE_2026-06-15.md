# Flow Finance - audit evidence operating guide

Data: 2026-06-15

## Purpose

This guide defines the offline evidence workflow that can be run without opening the app.

It does not prove real retention by itself. It organizes what is already observable so the audit does not depend on manual JSON interpretation.

## Commands

```bash
npm run health:cohort-state -- --min-distinct-review-weeks 2 --min-observation-days 7 --min-cohorts 1
npm run health:habit-proof -- --min-distinct-review-weeks 2 --min-observation-days 7 --min-cohorts 1
npm run health:ai-quality
npm run audit:claims
npm run audit:evidence
```

## Evidence states

- `nao_ativado`: no activation event observed for the workspace/user cohort.
- `bloqueado`: activation exists but was not qualified by useful dashboard use or completed financial base.
- `ativado_qualificado`: qualified activation exists, but no recurring weekly review is proven yet.
- `revisao_1_semana`: at least one weekly review exists after qualified activation.
- `habito_minimo`: declared thresholds are satisfied.

## Product event contract

Canonical source:

- `src/app/productAnalyticsContract.ts`

The contract defines:

- allowed product analytics events
- allowed properties per event
- sensitive property names that must be dropped before provider/backend persistence

Sensitive identifiers such as workspace/user ids, emails, names, CPF, phones, tokens, cookies, passwords and secrets must not be sent as analytics properties.

Workspace/user identity can still exist as backend auth or event-store context. It must not be duplicated into analytics payload properties.

## AI quality evidence

Canonical offline runner:

- `scripts/check-ai-quality-evidence.mjs`

Latest generated artifact:

- `test-results/ai-quality-evidence/2026-06-15T15-58-50-940Z/report.json`
- `test-results/ai-quality-evidence/2026-06-15T15-58-50-940Z/report.md`

Current reading:

- `PASS`
- average score: `1.0000`
- cases covered: cash position, risk fallback, monthly summary

This proves only that canonical offline responses satisfy the current quality contract. It does not prove perceived quality, cost, retention impact, or broad production behavior.

## Claims guard

Canonical runner:

- `scripts/check-audit-claims.mjs`

Policy document:

- `docs/CLAIMS_GUARD_2026-06-15.md`

The guard scans active docs and blocks uncaveated claims such as retention proven, habit proven, AI validated by users, paid conversion proven, investment endorsement, or readiness for broad commercial scale.

Allowed language must keep the evidence boundary explicit: `SEM EVIDENCIA SUFICIENTE`, `nao prova`, `BLOCK`, `piloto privado controlado`, `validacao parcial`, or `gate tecnico fechado, nao prova comercial`.

Latest generated artifact:

- `test-results/audit-claims/2026-06-15T16-13-28-811Z/report.json`
- `test-results/audit-claims/2026-06-15T16-13-28-811Z/report.md`

Current reading:

- `PASS`
- scanned files: `70`
- violations: `0`

## Current offline evidence package

Latest generated package:

- `test-results/audit-evidence/2026-06-15T16-13-36-386Z/report.json`
- `test-results/audit-evidence/2026-06-15T16-13-36-386Z/report.md`

Current reading:

- activation export: `PASS`
- activation checker: `PASS`
- visual regression: `PASS`
- AI quality: `PASS`
- claims guard: `PASS`
- habit proof: `BLOCK`
- cohort state: `BLOCK`

Interpretation:

The product is instrumented for honest recurrence proof, but recurring habit is still not proven without another real weekly export after qualified activation.
