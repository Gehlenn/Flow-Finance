# Mapa da Documentação

Este arquivo organiza `docs/` por finalidade. A meta é reduzir tempo de busca e impedir que documentos históricos sejam confundidos com estado operacional vivo.

## Trilhas canonicas

### Trilhas de entrada

1. [COMECE_AQUI.md](./COMECE_AQUI.md)
2. [README.md](../README.md)
3. [OPERATIONS_README.md](./OPERATIONS_README.md)
4. [ROADMAP.md](./ROADMAP.md)
5. [CHANGELOG.md](./CHANGELOG.md)

### Fonte de verdade operacional

Use primeiro estes documentos para status real, readiness e bloqueios atuais:

- [OPERATIONS_README.md](./OPERATIONS_README.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md](./RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md)
- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)

### Fonte de verdade historica e de evidencia

Use estes mapas quando a pergunta for sobre auditoria antiga, justificativa de versao ou memoria tecnica:

- [HISTORICAL_README.md](./HISTORICAL_README.md)
- [AUDIT_AND_EVIDENCE_INDEX.md](./AUDIT_AND_EVIDENCE_INDEX.md)

## Operacao, setup e deploy

- [DEPLOYMENTS.md](./DEPLOYMENTS.md)
- [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- [SETUP_GUIA_PT.md](./SETUP_GUIA_PT.md)
- [RESUMO_SETUP.md](./RESUMO_SETUP.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- [VERCEL_QUICK_START.md](./VERCEL_QUICK_START.md)

Regra pratica:

- `SETUP_GUIDE.md` é a fonte canônica de setup
- `SETUP_GUIA_PT.md` é o atalho curto
- `RESUMO_SETUP.md` existe apenas para redirecionar referencias antigas
- `VERCEL_QUICK_START.md` é o checklist mínimo de Vercel

## Produto, arquitetura e operacao

- [FLOW_FINANCE_PROJECT_RULES.md](./FLOW_FINANCE_PROJECT_RULES.md)
- [FLOW_FINANCE_PRODUCT_PLAN.md](./FLOW_FINANCE_PRODUCT_PLAN.md)
- [FLOW_FINANCE_CODE_TASKS.md](./FLOW_FINANCE_CODE_TASKS.md)
- [PROJECT_STACK_GUIDE.md](./PROJECT_STACK_GUIDE.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ARCHITECTURE_SYSTEM_MAP.md](./ARCHITECTURE_SYSTEM_MAP.md)
- [SAAS_ARCHITECTURE.md](./SAAS_ARCHITECTURE.md)
- [MONETIZATION_FREE_PRO_PHASE6.md](./MONETIZATION_FREE_PRO_PHASE6.md)
- [OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md](./OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md)
- [RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md](./RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md)
- [RUNBOOK_BUSINESS_INTEGRATION.md](./RUNBOOK_BUSINESS_INTEGRATION.md)
- [RUNBOOK_CLINIC_INTEGRATION.md](./RUNBOOK_CLINIC_INTEGRATION.md)

## Billing, observabilidade e contratos sensiveis

- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- [SENTRY_SETUP.md](./SENTRY_SETUP.md)
- [HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md](./HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md)

## Mobile

- [MOBILE_BUILD_GUIDE.md](./MOBILE_BUILD_GUIDE.md)
- [MOBILE_TESTING_PLAN.md](./MOBILE_TESTING_PLAN.md)
- [MOBILE_TESTING_STATUS.md](./MOBILE_TESTING_STATUS.md)
- [ANDROID_MANIFEST.xml](./ANDROID_MANIFEST.xml) (referência)
- [IOS_INFO_PLIST.xml](./IOS_INFO_PLIST.xml) (referência)

## Seguranca e risco

- [SECRET_INCIDENT_CHECKLIST.md](./SECRET_INCIDENT_CHECKLIST.md)
- [OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md](./OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md)
- [archive/SECURITY_REVIEW_CLINIC_v0.9.2.md](./archive/SECURITY_REVIEW_CLINIC_v0.9.2.md)
- [archive/SECURITY_UPDATES_v0.1.0.md](./archive/SECURITY_UPDATES_v0.1.0.md)
- [archive/PRODUCTION_RISK_REVIEW_2026-04-11.md](./archive/PRODUCTION_RISK_REVIEW_2026-04-11.md)

## Documentos auxiliares especializados

- [E2E_SKIP_STRATEGY.md](./E2E_SKIP_STRATEGY.md)
- [CI_DOCKER_OPTIN_OPERATION.md](./CI_DOCKER_OPTIN_OPERATION.md)
- [OPENAPI_MULTI_TENANT.yaml](./OPENAPI_MULTI_TENANT.yaml)
- [archive/UI_SIMPLIFICACAO_CICLO_1.md](./archive/UI_SIMPLIFICACAO_CICLO_1.md)
- [archive/DATABASE_DECISION.md](./archive/DATABASE_DECISION.md)

## Regras de manutencao

- documento vivo precisa estar referenciado aqui, no README raiz ou no mapa operacional
- documento historico precisa estar referenciado em `docs/HISTORICAL_README.md` ou `docs/AUDIT_AND_EVIDENCE_INDEX.md`
- mudanca estrutural precisa ser refletida no vault na mesma passada
