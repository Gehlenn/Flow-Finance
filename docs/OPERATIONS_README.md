# Mapa Operacional

Este arquivo concentra os documentos de operacao atual do Flow Finance. Ele existe para separar claramente runbooks e materiais de execucao viva de auditorias historicas e textos de contexto antigo.

## Ordem de leitura recomendada

1. [docs/DEPLOYMENT_STATUS.md](E:\app e jogos criados\Flow-Finance\docs\DEPLOYMENT_STATUS.md)
2. [docs/VERCEL_CONFIG.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_CONFIG.md)
3. [docs/RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md)

## Estado operacional atual

- suite global: `verde`
- billing Stripe sandbox: `validado localmente`
- bloqueio atual: fechamento do ambiente alvo no Vercel

## Operacao geral

- [docs/RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md)
- [docs/OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md](E:\app e jogos criados\Flow-Finance\docs\OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md)
- [docs/ROBUSTNESS_OPERATIONAL_v0.9.2.md](E:\app e jogos criados\Flow-Finance\docs\ROBUSTNESS_OPERATIONAL_v0.9.2.md)

## Deploy e ambiente alvo

- [docs/DEPLOYMENT.md](E:\app e jogos criados\Flow-Finance\docs\DEPLOYMENT.md)
- [docs/VERCEL_DEPLOYMENT.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_DEPLOYMENT.md)
- [docs/VERCEL_QUICK_START.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_QUICK_START.md)
- [docs/SETUP_GUIDE.md](E:\app e jogos criados\Flow-Finance\docs\SETUP_GUIDE.md)

## Billing e observabilidade

- [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](E:\app e jogos criados\Flow-Finance\docs\EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- [docs/SENTRY_SETUP.md](E:\app e jogos criados\Flow-Finance\docs\SENTRY_SETUP.md)
- [docs/HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md)

## Integracoes

- [docs/RUNBOOK_BUSINESS_INTEGRATION.md](E:\app e jogos criados\Flow-Finance\docs\RUNBOOK_BUSINESS_INTEGRATION.md)
- [docs/RUNBOOK_CLINIC_INTEGRATION.md](E:\app e jogos criados\Flow-Finance\docs\RUNBOOK_CLINIC_INTEGRATION.md)

## Gate de testes

- `npm run test:coverage` valida a suite global
- `npm run test:coverage:critical` preserva o recorte critico
- `npm run test:firestore:rules` continua sendo o gate obrigatorio das rules do Firestore com emulator

## Uso correto

- Se a pergunta for sobre como operar hoje, use primeiro este mapa.
- Se a pergunta for sobre historico, investigacao antiga ou justificativa de decisao passada, use o mapa historico.
