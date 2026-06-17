# Indice de Auditorias e Evidencias

Este documento centraliza auditorias, evidencias operacionais e materiais de comprovacao. A funcao dele e evitar que cada evidencia fique solta e sem contexto.

Ultima revisao estrutural: 2026-06-17

## Entrada recomendada (historico)

Se o objetivo for entender decisoes antigas, auditorias passadas ou diagnosticos encerrados, comece por:

- [HISTORICAL_README.md](./HISTORICAL_README.md) (mapa historico)
- [archive/README.md](./archive/README.md) (indice do arquivo `docs/archive/`)

## Evidencias operacionais vivas

- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- [HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md](./HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md)

## Auditorias correntes

- [AUDIT_FLOW_FOCUS_2026-04-24.md](./AUDIT_FLOW_FOCUS_2026-04-24.md)
- [CODE_QUALITY_CLEANUP_2026-04-30.md](./CODE_QUALITY_CLEANUP_2026-04-30.md)
- [AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md](./AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md)
- [AUDIT_CURRENT_SCORECARD_2026-06-13.md](./AUDIT_CURRENT_SCORECARD_2026-06-13.md)
- [POST_AUDIT_EXECUTION_PLAN_2026-06-11.md](./POST_AUDIT_EXECUTION_PLAN_2026-06-11.md)
- [HABIT_PROOF_PROGRAM_2026-06-13.md](./HABIT_PROOF_PROGRAM_2026-06-13.md)
- [UI_UX_AI_PARTIAL_REVIEW_2026-06-13.md](./UI_UX_AI_PARTIAL_REVIEW_2026-06-13.md)
- [PRODUCT_FOCUS_SURFACE_REVIEW_2026-06-11.md](./PRODUCT_FOCUS_SURFACE_REVIEW_2026-06-11.md)
- [SCALE_READINESS_REVIEW_2026-06-11.md](./SCALE_READINESS_REVIEW_2026-06-11.md)
- [LOAD_SCENARIO_MATRIX_2026-06-11.md](./LOAD_SCENARIO_MATRIX_2026-06-11.md)
- `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json` (runner consolidado: `L2 PASS`, `L3 PASS`, `L4 PASS`, `L1/L5 DOCUMENTED_ONLY`)
- `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json` (fechamento publicado de `R1`: export `PASS`)
- `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json` (fechamento publicado de `R1`: checker `PASS`)
- `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json` (fechamento publicado de `R1`: refresh `PASS`)
- `test-results/habit-proof-evidence/2026-06-13T14-57-20-595Z/report.json` (primeira leitura longitudinal de habito: `BLOCK` honesto por falta de threshold explicito)
- `test-results/habit-proof-evidence/2026-06-13T16-13-53-986Z/report.json` (leitura longitudinal com threshold explicito: `BLOCK` por falta de semanas/dias suficientes)
- `test-results/activation-retention-refresh/2026-06-17T03-55-16-207Z/report.json` (R1 revalidado no app publicado: refresh `PASS` como gate tecnico, nao prova retencao comercial)
- `test-results/activation-retention-export/2026-06-17T03-55-18-245Z/report.json` (export publicado atual: `PASS`)
- `test-results/activation-retention-evidence/2026-06-17T03-55-19-183Z-events/report.json` (checker publicado atual: `PASS`)
- `test-results/scale-readiness-evidence/2026-06-17T03-52-38-900Z/report.json` (scale readiness atual: `PASS`, com `L1/L5 DOCUMENTED_ONLY`)
- `test-results/target-performance-evidence/2026-06-17T03-53-15-520Z/report.json` (performance alvo atual: `PASS`)
- `test-results/visual-regression/2026-06-17T03-54-12-212Z/manifest.json` (regressao visual atual: `PASS`, `12` screenshots)
- `test-results/habit-proof-evidence/2026-06-17T03-54-11-832Z/report.json` (habit proof atual: `BLOCK`, uma semana apenas)
- `test-results/cohort-state/2026-06-17T03-54-11-856Z/report.json` (cohort state atual: `BLOCK`, workspace em `revisao_1_semana`)
- `test-results/audit-evidence/2026-06-17T04-01-23-114Z/report.json` (pacote consolidado atual: `BLOCK` somente por habito/coorte)

## Status operacional

- [README.md](../README.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [PUBLISHED_REVALIDATION_CHECKLIST_2026-06-11.md](./PUBLISHED_REVALIDATION_CHECKLIST_2026-06-11.md)
- [ROADMAP.md](./ROADMAP.md)
- Revalidacao viva de deploy em 2026-05-25: `health:vercel` passou com backend oficial em `0.9.7`.
- Passada de polimento visual concluida em 2026-05-26: empty states e modais menores foram alinhados a mesma linguagem visual das superficies principais.
- Fechamento de acabamento visual em 2026-05-26: `Login` e `Settings` foram conferidos em desktop e mobile, com preservacao intencional de acentos apenas em acoes primarias e estados semanticos.
- `tests/unit/cashflow-clarity.test.tsx` continua como evidencia viva para hierarquia do painel, relatorio salvo e invalidacao do recorte.
- [VERCEL_RECOVERY_CHECKLIST.md](./VERCEL_RECOVERY_CHECKLIST.md)

## Runbooks e referencias operacionais ativas

- [RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md](./RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md)
- [OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md](./OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md)
- [SECRET_INCIDENT_CHECKLIST.md](./SECRET_INCIDENT_CHECKLIST.md)
- [SENTRY_SETUP.md](./SENTRY_SETUP.md)

## Evidencias de release e checkpoints

- [archive/PR_SUMMARY_0.9.6.md](./archive/PR_SUMMARY_0.9.6.md)
- [archive/PR_SUMMARY_0.9.5.md](./archive/PR_SUMMARY_0.9.5.md)
- [archive/RELEASE_SUMMARY_v0.5.2v.md](./archive/RELEASE_SUMMARY_v0.5.2v.md)
- [archive/PROMPT_FINAL_GO_NO_GO_CROSS_BROWSER_v0.9.x.md](./archive/PROMPT_FINAL_GO_NO_GO_CROSS_BROWSER_v0.9.x.md)

## Auditorias e buglog (historico)

Entrada rapida:

- [archive/BUGLOG.md](./archive/BUGLOG.md)
- [archive/CHANGELOG_ANTIGO.md](./archive/CHANGELOG_ANTIGO.md)
- [archive/PRODUCTION_RISK_REVIEW_2026-04-11.md](./archive/PRODUCTION_RISK_REVIEW_2026-04-11.md)
- [archive/AUDITORIA_THOROUGH_2026-03-11.md](./archive/AUDITORIA_THOROUGH_2026-03-11.md)
- `archive/AUDIT_REPORT_v0.3.0.md` ate `archive/AUDIT_REPORT_v0.6.1.md` (serie historica)

## Historico arquivado

- [archive/CODE_REALITY_MATRIX_v0.6_to_v0.9_2026-04-11.md](./archive/CODE_REALITY_MATRIX_v0.6_to_v0.9_2026-04-11.md)
- [archive/CHECKLIST_EXECUCAO_PRIORIZADA_v0.7_v0.9_2026-04-11.md](./archive/CHECKLIST_EXECUCAO_PRIORIZADA_v0.7_v0.9_2026-04-11.md)
- [archive/ASSESSMENT_PHASES_1_TO_6_2026-04-11.md](./archive/ASSESSMENT_PHASES_1_TO_6_2026-04-11.md)
- [archive/ASSESSMENT_V0_6X_CLOSURE_CODE_REALITY_2026-04-11.md](./archive/ASSESSMENT_V0_6X_CLOSURE_CODE_REALITY_2026-04-11.md)
- [archive/SECURITY_REVIEW_CLINIC_v0.9.2.md](./archive/SECURITY_REVIEW_CLINIC_v0.9.2.md)
- [archive/AUDITORIA_THOROUGH_2026-03-11.md](./archive/AUDITORIA_THOROUGH_2026-03-11.md)
- [archive/SECURITY_UPDATES_v0.1.0.md](./archive/SECURITY_UPDATES_v0.1.0.md)
- [archive/ROBUSTNESS_OPERATIONAL_v0.9.2.md](./archive/ROBUSTNESS_OPERATIONAL_v0.9.2.md)
- [archive/SENTRY_SETUP_GUIDE.md](./archive/SENTRY_SETUP_GUIDE.md)
- [archive/DATABASE_DECISION.md](./archive/DATABASE_DECISION.md)
- [archive/README.md](./archive/README.md)

## Regra de manutencao

- evidencia viva precisa continuar referenciada no README raiz ou no mapa operacional
- quando um material perder valor operacional e servir apenas como memoria, mover para `docs/archive/`
- antes de arquivar uma revisao de seguranca, verificar se os achados ainda estao abertos no codigo ou registrar que o item e apenas historico
- referencias a modulos removidos devem ficar apenas em docs de auditoria ou historico, nao em paginas ativas
- `src/runtime/chunkGuard.ts` perdeu o alias legado `initChunkGuard` e o export morto `resetChunkErrorCount`
- `src/runtime/versionGuard.ts` perdeu o helper morto de notificacao de mismatch de versao
