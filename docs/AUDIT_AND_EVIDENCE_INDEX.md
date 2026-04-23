# Indice de Auditorias e Evidencias

Este documento centraliza auditorias, evidencias operacionais e materiais de comprovacao. A funcao dele e evitar que cada evidencia fique solta e sem contexto.

Ultima revisao estrutural: 2026-04-22

## Evidencias operacionais vivas

- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- [HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md](./HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md)

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

## Historico arquivado

- [archive/PRODUCTION_RISK_REVIEW_2026-04-11.md](./archive/PRODUCTION_RISK_REVIEW_2026-04-11.md)
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
