# Indice de Auditorias e Evidencias

Este documento centraliza auditorias, evidencias operacionais e materiais de comprovacao. A funcao dele e evitar que cada evidencia fique solta e sem contexto.

Ultima revisao estrutural: 2026-05-26

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

## Status operacional

- [README.md](../README.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
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
