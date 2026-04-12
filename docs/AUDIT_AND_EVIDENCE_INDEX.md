# Indice de Auditorias e Evidencias

Este documento centraliza a leitura de auditorias, evidencias operacionais e materiais de comprovacao. A funcao dele e evitar que cada evidencia fique solta e sem contexto.

Ultima revisao estrutural: 2026-04-12

## Evidencias operacionais vivas

Esses documentos comprovam capacidades ou gates que ainda importam para o estado atual do projeto:

- [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](E:\app e jogos criados\Flow-Finance\docs\EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- [docs/HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md)

## Runbooks e referencias operacionais ativas

Documentos com funcao operacional continuada:

- [docs/RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md) — referencia consolidada da linha v0.9.x
- [docs/OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md](E:\app e jogos criados\Flow-Finance\docs\OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md) — flags e kill switches
- [docs/SECRET_INCIDENT_CHECKLIST.md](E:\app e jogos criados\Flow-Finance\docs\SECRET_INCIDENT_CHECKLIST.md) — resposta a incidente de segredo
- [docs/ROBUSTNESS_OPERATIONAL_v0.9.2.md](E:\app e jogos criados\Flow-Finance\docs\ROBUSTNESS_OPERATIONAL_v0.9.2.md) — referencia tecnica de telemetria, flags e anti-prompt injection

## Evidencias de release e checkpoints

- [docs/archive/PR_SUMMARY_0.9.6.md](E:\app e jogos criados\Flow-Finance\docs\archive\PR_SUMMARY_0.9.6.md)
- [docs/archive/PR_SUMMARY_0.9.5.md](E:\app e jogos criados\Flow-Finance\docs\archive\PR_SUMMARY_0.9.5.md)
- [docs/archive/RELEASE_SUMMARY_v0.5.2v.md](E:\app e jogos criados\Flow-Finance\docs\archive\RELEASE_SUMMARY_v0.5.2v.md)
- [docs/archive/PROMPT_FINAL_GO_NO_GO_CROSS_BROWSER_v0.9.x.md](E:\app e jogos criados\Flow-Finance\docs\archive\PROMPT_FINAL_GO_NO_GO_CROSS_BROWSER_v0.9.x.md)

## Historico arquivado

Auditorias, assessments e checklists de ciclos encerrados ficam em `docs/archive/`:

- [docs/archive/PRODUCTION_RISK_REVIEW_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\archive\PRODUCTION_RISK_REVIEW_2026-04-11.md) — risco residual do ciclo 0.9.x; addendum de 2026-04-12 encerrou o item de billing
- [docs/archive/CODE_REALITY_MATRIX_v0.6_to_v0.9_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\archive\CODE_REALITY_MATRIX_v0.6_to_v0.9_2026-04-11.md) — matriz do ciclo v0.6 a v0.9 encerrado
- [docs/archive/CHECKLIST_EXECUCAO_PRIORIZADA_v0.7_v0.9_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\archive\CHECKLIST_EXECUCAO_PRIORIZADA_v0.7_v0.9_2026-04-11.md) — todos P0 concluidos, ciclo 0.9.6 GO
- [docs/archive/ASSESSMENT_PHASES_1_TO_6_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\archive\ASSESSMENT_PHASES_1_TO_6_2026-04-11.md) — fechamento v0.6.x fases 1-6
- [docs/archive/ASSESSMENT_V0_6X_CLOSURE_CODE_REALITY_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\archive\ASSESSMENT_V0_6X_CLOSURE_CODE_REALITY_2026-04-11.md) — avaliacao de codigo da linha v0.6.x
- [docs/archive/SECURITY_REVIEW_CLINIC_v0.9.2.md](E:\app e jogos criados\Flow-Finance\docs\archive\SECURITY_REVIEW_CLINIC_v0.9.2.md) — revisao historica de seguranca da integracao clinica; todos os quick wins identificados foram implementados: idempotencia atomica (`SET NX EX`), rate limit distribuido via Redis (`createDistributedRateLimitByUser`), validacao de `externalEventId` com regex e limite de tamanho, ordem de middlewares com edge limiter antes de auth
- [docs/archive/AUDITORIA_THOROUGH_2026-03-11.md](E:\app e jogos criados\Flow-Finance\docs\archive\AUDITORIA_THOROUGH_2026-03-11.md) — auditoria de maturidade de marco/26
- [docs/archive/SECURITY_UPDATES_v0.1.0.md](E:\app e jogos criados\Flow-Finance\docs\archive\SECURITY_UPDATES_v0.1.0.md) — hardening inicial v0.1.0
- [docs/archive/README.md](E:\app e jogos criados\Flow-Finance\docs\archive\README.md) — indice geral do archive

## Regra de manutencao

- evidencia viva precisa continuar referenciada no README raiz ou no mapa operacional
- quando um material perder valor operacional e servir apenas como memoria, mover para `docs/archive/`
- antes de arquivar uma revisao de seguranca, verificar se os achados ainda estao abertos no codigo; registrar o status real na nota do item arquivado
