# Flow Finance - claims guard

Data: 2026-06-15

## Purpose

This guard prevents the audit material from turning technical evidence into commercial proof.

The product can be described as ready for a controlled private pilot when the relevant gates pass. It must not be described as retention-proven, AI-validated by users, conversion-proven, or ready for broad commercial scale without direct evidence.

## Command

```bash
npm run audit:claims
```

## Blocked claims unless explicitly caveated

- Retention proven, habit proven, durable habit proven, retention rate proven.
- AI validated by real users, autonomous CFO, AI learns from users, AI moves behavior.
- Paid conversion proven, monetization proven, pricing validated economically.
- SaaS ready for broad commercial scale or production scale.
- Investment or payment endorsement without the current evidence boundary.

## Allowed language

- `SEM EVIDENCIA SUFICIENTE`.
- `nao prova`.
- `BLOCK`.
- `piloto privado controlado`.
- `validacao parcial`.
- `gate tecnico fechado, nao prova comercial`.

## Current boundary

Allowed:

- The technical activation gate passed in the audited artifact.
- AI canonical offline quality passed in the audited artifact.
- Visual regression passed in the audited artifact.
- The product is suitable for controlled private pilot discussion.

Not allowed:

- Retention is proven.
- Habit is proven.
- AI quality is validated by users.
- Paid conversion is proven.
- The SaaS is ready for broad commercial scale.

## Evidence

Latest expected artifact family:

- `test-results/audit-claims/<timestamp>/report.json`
- `test-results/audit-claims/<timestamp>/report.md`

This report does not prove the business. It only blocks documentation from overstating what the current evidence proves.
