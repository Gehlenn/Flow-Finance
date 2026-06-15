# Mapa Operacional

Este arquivo concentra os documentos de operacao atual do Flow Finance. Ele separa runbooks vivos de auditorias e evidencias historicas.

## Ordem de leitura recomendada

1. [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
2. [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
3. [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
4. [RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md](./RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md)

## Estado operacional atual

- suite global: `verde`
- billing Stripe sandbox: `validado localmente`
- backend oficial: `0.9.7` revalidado novamente em `2026-06-12`
- pendencia operacional atual: nao ha bloqueio tecnico publicado confirmado; os gates de ativacao/retencao, performance e Stripe estao fechados, e o refresh publicado de `2026-06-12` confirmou a durabilidade do event store
- pendencia residual de produto: habito real ao longo do tempo agora e acompanhado separadamente em `docs/HABIT_PROOF_PROGRAM_2026-06-13.md` e nao reabre os gates tecnicos ja fechados
- evidencias de ativacao/retencao:
  - `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
  - `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json`
  - `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/events.jsonl`
  - `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json`
  - `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.md`
  - `test-results/activation-retention-export/published-export-verified.json`
- polimento visual principal: concluido sem alterar os contratos operacionais

## Operacao geral

- [RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md](./RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md)
- [OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md](./OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md)
- [SECRET_INCIDENT_CHECKLIST.md](./SECRET_INCIDENT_CHECKLIST.md)

## Deploy e ambiente alvo

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- [VERCEL_QUICK_START.md](./VERCEL_QUICK_START.md)
- [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## Estado do contrato publico

- `/health` responde `200`
- `/api/health` responde `200`
- `/api/version` responde `200` com `0.9.7`
- os tres endpoints acima ja expõem `workspacePersistence` no backend publicado endurecido
- `/health` e `/api/health` agora tambem expõem `domainEventPersistence = healthy` no backend publicado endurecido
- `/` no backend responde `404` esperado para API-only

## Billing e observabilidade

- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- [TARGET_PERFORMANCE_EVIDENCE_2026-06-04.md](./TARGET_PERFORMANCE_EVIDENCE_2026-06-04.md)
- [HABIT_PROOF_PROGRAM_2026-06-13.md](./HABIT_PROOF_PROGRAM_2026-06-13.md)
- [SENTRY_SETUP.md](./SENTRY_SETUP.md)
- [HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md](./HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md)

## Integracoes

- [RUNBOOK_BUSINESS_INTEGRATION.md](./RUNBOOK_BUSINESS_INTEGRATION.md)
- [RUNBOOK_CLINIC_INTEGRATION.md](./RUNBOOK_CLINIC_INTEGRATION.md)

## Gate de testes

- `npm run test:coverage` valida a suite global
- `npm run test:coverage:critical` preserva o recorte critico
- `npm run test:firestore:rules` continua sendo o gate obrigatorio das rules do Firestore com emulator

## Uso correto

- se a pergunta for sobre como operar hoje, use primeiro este mapa
- se a pergunta for sobre historico, auditoria antiga ou justificativa de decisao passada, use [HISTORICAL_README.md](./HISTORICAL_README.md)
