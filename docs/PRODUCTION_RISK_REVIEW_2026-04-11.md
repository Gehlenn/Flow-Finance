# Production Risk Review - Auth, Quota IA, Sync, Billing

Data: 2026-04-11
Escopo: revisao tecnica de risco baseada no estado real do codigo

## Resumo

- Estado geral: controlado com hardening relevante implementado.
- Risco residual: medio em sync conflict strategy, paridade de ambiente frontend/backend e observabilidade minima em ambiente alvo.
- Risco adicional de governanca: medio, concentrado em fonte de verdade documental (`AGENTS.md`/`ROADMAP.md`).

## Status consolidado em 2026-04-11

A linha v0.9.x esta validada operacionalmente no recorte critico executado, com dominio, integracoes e gates de qualidade em verde.

O nucleo validado inclui:
- auth e workspace scope
- billing/admin e gating principal
- sync com politica de conflito validada
- business integration
- importacao, scanner/OCR e quota no recorte critico coberto
- lint e cobertura critica aprovados

No estado atual, nao ha evidencia de falha real de codigo no recorte validado.

A dependencia remanescente para fechamento final de release esta concentrada na paridade de ambiente frontend/backend e na observabilidade minima em ambiente alvo.

Criterio de saida para fechamento final:
- alinhar endpoints/versionamento no ambiente de QA para eliminar `404` nao-funcionais
- manter o fallback de login local restrito a `development` e validar a trilha visual completa do admin em ambiente equivalente
- manter a matriz E2E como gate regressivo

Veredito atual:
v0.9.x esta operacionalmente consistente no recorte validado, com matriz E2E cross-browser/device executada, billing Stripe sandbox comprovado e trilha visual local do admin destravada sem Firebase; o fechamento final de release ainda depende de paridade de ambiente e observabilidade minima.

## 1) Auth (JWT, sessao, workspace context)

Status: MITIGADO

Evidencias:

- `backend/src/config/env.ts` valida `JWT_SECRET` em producao (>= 32 chars)
- `backend/src/middleware/auth.ts` aplica verificacao JWT, tokenType e contexto de request
- `backend/src/middleware/workspaceContext.ts` exige `x-workspace-id` valido e membership

Riscos residuais:

- fluxo de refresh/token rotation exige validacao continua em ambiente alvo
- necessidade de monitorar regressao entre modos de autenticacao (mock/test/prod)

Recomendacoes:

1. adicionar teste de smoke de auth/session em staging por release
2. reforcar verificacao de cookie/token path em deploy

## 2) Quota IA

Status: MITIGADO (com pontos de atencao)

Evidencias:

- `backend/src/middleware/quota.ts` aplica limite por plano/escopo, headers e `429`
- eventos de quota excedida gravados em trilha de auditoria

Riscos residuais:

- calibragem de limites pode divergir do uso real sem telemetria de producao

Recomendacoes:

1. validar cenarios de burst e abuso em staging
2. revisar limites por plano com dados reais de uso mensal

## 2.1) Prioridade de provider de IA

Status: MITIGADO

Evidencias:

- frontend sensivel ja usa proxy/backend, sem segredo de provider no cliente
- `backend/src/services/ai/AIOrchestrator.ts` e `AIServiceFactory.ts` suportam provider primario + fallback com logs
- `backend/src/config/env.ts` agora define `AI_PRIMARY_PROVIDER=gemini` e `AI_FALLBACK_PROVIDER=openai` por padrao
- `backend/src/services/ai/AIServiceFactory.ts` segue o mesmo default no orquestrador
- `backend/src/config/ai.ts` tambem foi alinhado para `Gemini -> OpenAI`

Riscos residuais:

- calibragem de custo e comportamento ainda depende de observacao em ambiente real, mas o default agora esta alinhado com o plano

Recomendacoes:

1. manter os runbooks e `.env.example` alinhados com o default atual
2. observar custo e taxa de fallback em ambiente alvo

## 2.2) Categorizacao IA

Status: NUCLEO TECNICO FECHADO (com risco residual operacional)

Evidencias:

- `src/services/ai/categorizationService.ts` agora centraliza a classificacao remota e o fallback local
- `src/services/ai/categorizationSchema.ts` projeta a mesma resposta canonica para `Category` do produto e `FinanceCategory` do motor
- `src/finance/importService.ts` deixou de consumir o endpoint bruto e passou a usar o servico canonico
- `src/engines/finance/categorization/aiCategorizerFallback.ts` passou a normalizar categorias pelo mesmo contrato
- testes unitarios novos cobrem normalizacao, fallback e consumo no import

Riscos residuais:

- ainda existe heuristica de mapeamento entre taxonomia detalhada do motor e as 4 categorias do produto
- OCR/importacao continuam pedindo endurecimento operacional em ambiente real, sobretudo para confianca e casos ambiguos

Veredito do eixo:

- nucleo tecnico de importacao/OCR/categorizacao esta fechado no codigo e validado
- risco residual remanescente e operacional (ambiente real), sem backlog estrutural de codigo neste eixo

Recomendacoes:

1. manter qualquer nova entrada de categorizacao passando pelo contrato canonico
2. observar falsos positivos/negativos em staging antes de expandir taxonomias

Atualizacao P0 (2026-04-11):

- divergencia de contrato em categoria composta foi resolvida: `Trabalho / Consultorio` agora normaliza para `financeCategory=servicos`
- testes focados de categorizacao e importacao passaram apos ajuste

## 3) Sync e conflitos

Status: MITIGADO (com pontos de atencao)

Evidencias:

- `backend/src/routes/sync.ts` exige auth + workspaceContext + validacao schema
- push/pull com escopo de workspace e auditoria por entidade
- OpenAPI documenta idempotencia por `sourceSystem + externalRecordId`
- `backend/src/services/sync/cloudSyncStore.ts` agora aplica policy explicita `client-updated-at-last-write-wins`
- o resultado de `/api/sync/push` agora retorna `conflictPolicy` e `conflicts`
- testes dedicados foram adicionados para conflito stale e timestamp empatado com payload divergente

Riscos residuais:

- ainda falta evidencia consolidada de stress concorrente em ambiente alvo
- a policy atual preserva o registro existente em empate com payload divergente; se o dominio exigir merge por campo no futuro, isso deve virar evolucao contratual e nao ajuste informal

Recomendacoes:

1. rodar bateria de concorrencia em ambiente alvo quando o runner de testes permitir
2. manter a policy documentada no contrato e no OpenAPI

## 4) Billing real e ambiente de execucao

Status: MITIGADO NO SANDBOX E NA UI LOCAL DE DEVELOPMENT

Evidencias:

- `backend/src/routes/saas.ts` possui endpoints de checkout, portal, webhooks e plano
- `backend/src/services/saas/billingService.ts` expõe no catalogo de planos as capacidades reais de billing (`stripeConfigured`, `stripePortalEnabled`, `billingProvider`, `manualPlanChangeAllowed`)
- `src/saas/billingClient.ts` consome o contrato SaaS de checkout/portal/catalogo no frontend
- `src/services/firestoreBillingStore.ts` registra estado de plano, hooks e auditoria
- `pages/WorkspaceAdmin.tsx` decide entre `Start Pro checkout`, `Open billing portal` e fallback mock conforme o catalogo real
- matriz Playwright (`auth`, `dashboard`, `billing`) permaneceu verde apos a troca de wiring da UI
- evidencia operacional persistida em `docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md`
- fluxo sandbox validado com `checkout.session.completed`, `customer.subscription.created`, `invoice.paid` e `charge.succeeded` entregues com `200` ao webhook local
- workspace promovido para `pro`, `billingCustomerId` persistido e portal Stripe aberto com assinatura ativa
- `components/Login.tsx`, `hooks/useAuthAndWorkspace.ts` e `src/services/backendSession.ts` agora destravam login local em `development` quando Firebase nao estiver configurado, preservando o fluxo seguro de producao

Addendum 2026-04-12:

- a lacuna de auth/UI local deixou de ser bloqueio de readiness
- o residual principal deste eixo passou a ser observabilidade minima em ambiente alvo (`requestId`, `routeScope`, Sentry/DSN)
- `src/config/sentry.ts` foi ajustado para bootstrap silencioso sem DSN, reduzindo ruido de execucao e de suites browser
- `src/config/api.config.ts` agora promove contexto operacional (`requestId`, `routeScope`, `statusCode`) para a telemetria do frontend em falhas de API

Riscos residuais:

- frontend local ainda sem `VITE_FIREBASE_*`, impedindo repetir a trilha visual completa do `Workspace Admin` com login Firebase real
- a evidencia atual prova o nucleo operacional do billing, mas nao substitui a validacao visual final de auth/UI
- execucoes frontend-only ainda dependem de comportamento explicito de probe skip quando backend nao estiver presente; contrato foi alinhado e o ruído principal de `404` saiu do recorte E2E validado

Recomendacoes:

1. manter billing real em rollout controlado por gate operacional
2. abrir trilha separada para fechar auth/UI Firebase do frontend local e repetir a validacao visual do admin
3. manter a heuristica de probe skip para execucoes frontend-only e revisar apenas se o ambiente de QA passar a exigir backend obrigatorio

## 4.1) Gating Free/Pro

Status: PARCIALMENTE MITIGADO

Evidencias:

- `src/app/monetizationPlan.ts` centraliza o contrato de acesso por feature
- gating ativo em `pages/Insights.tsx`, `pages/AICFO.tsx`, `components/Assistant.tsx`, `pages/Autopilot.tsx` e `hooks/useNavigationTabs.tsx` (`Analytics`)
- testes dedicados existem para `Insights`, `Autopilot` e `monetizationPlan`

Riscos residuais:

- o residual atual nao e ausencia de gating nas principais superficies premium, e sim confirmar que nao restou nenhuma superficie secundaria premium fora do recorte principal

Recomendacoes:

1. manter toda nova feature premium passando por `monetizationPlan.ts`
2. revisar superfícies secundarias fora da navegacao principal antes de considerar a fase 6 fechada

## 5) Governanca documental e release source-of-truth

Status: PARCIALMENTE MITIGADO

Evidencias:

- `AGENTS.md` agora aponta explicitamente para o vault canonico ativo
- `ROADMAP.md` passou a carregar nota explicita de que e historico e nao fonte de verdade de release
- `package.json` e `package-lock.json` foram alinhados para `0.9.6`, em coerencia com `CHANGELOG.md`

Riscos residuais:

- residual baixo: o roadmap historico continua extenso, mas nao disputa mais a fonte de verdade operacional

Recomendacoes:

1. manter a matriz unica de realidade do codigo por versao como referencia de release
2. manter verificacao de consistencia de versao como gate de release

## 6) Microcopy consultiva do assistente

Status: MITIGADO

Evidencias:

- `src/app/assistantCopy.ts` padronizado com acentuacao e tom consultivo operacional
- `tests/unit/assistant-copy.test.ts` verde apos alinhamento explicito do contrato textual

Riscos residuais:

- baixo, limitado a regressao de texto em alteracoes futuras sem cobertura

Recomendacoes:

1. manter copy sensivel centralizada em arquivo unico
2. manter teste dedicado para evitar regressao de tom e terminologia

## Classificacao final

- Auth: Medio
- Quota IA: Baixo-Medio
- Prioridade de provider IA: Baixo-Medio
- Categorizacao IA: Baixo-Medio
- Sync conflitos: Medio
- Billing real: Baixo-Medio
- Governanca documental e source-of-truth: Baixo-Medio

Risco agregado para proxima release: MEDIO

## Referencia documental de contratos sensiveis

- Consolidacao de hardening contratual (status congelado no runtime spec): `docs/HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md`

## Reconciliacao oficial P1 (contratos HTTP sensiveis)

Matriz oficial por superficie e last-mile:
- `docs/HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md`

Status consolidado do P1:
- congelado no plano contratual; risco residual deste eixo e operacional/de ambiente
