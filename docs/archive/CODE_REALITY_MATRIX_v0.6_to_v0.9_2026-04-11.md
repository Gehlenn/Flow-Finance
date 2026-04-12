# Matriz de Realidade do Código - v0.6 a v0.9

Data: 2026-04-11
Escopo: avaliacao do codigo e dos contratos atuais, sem presumir que a documentacao previa estava correta

## Resumo executivo

- `0.6.x`: fechado no codigo e coerente com a trilha principal do produto.
- `0.7.x`: implementado de forma relevante, mas sem fechamento formal unificado.
- `0.8.x`: nucleo tecnico fechado; intake, OCR, integracoes e categorizacao canonica estao consolidados no codigo, com risco residual operacional em ambiente real.
- `0.9.x`: avancado, com base SaaS real no codigo, matriz E2E cross-browser/device validada, probes frontend-only reconciliados, admin de billing ligado a checkout/portal real, billing Stripe sandbox operacionalmente provado e fallback de login local em `development`; ainda nao fechado para release por hardening final de ambiente e observabilidade alvo.

Atualizacao contratual desta sessao:
- freeze HTTP sensivel (`auth`, `sync`, `finance/metrics`, `saas`) agora esta explicitado no runtime spec; risco remanescente nesse eixo passou a ser operacional/de ambiente.

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
- manter os probes de backend/version com skip benigno em frontend-only e validar qualquer ambiente com backend obrigatorio separadamente
- manter o fallback de login local restrito a `development` e validar a trilha visual do admin em ambiente equivalente
- manter a matriz E2E regressiva no CI

Veredito atual:
v0.9.x esta operacionalmente consistente no recorte validado, com matriz E2E cross-browser/device executada, probes frontend-only reconciliados, admin ligado a billing real, billing Stripe sandbox comprovado e auth/UI local destravada em `development`; o fechamento final ainda depende de hardening de ambiente e observabilidade minima.

## Matriz por fase do bundle de abril

| Fase | Tema | Estado no codigo | Veredito |
|---|---|---|---|
| 1 | AI and unified intake | `transactionDraft`, `intakeNormalizer`, `AIInput`, scanner/backend proxy, providers alinhados, testes | Fechada |
| 2 | Business integration contract | rotas `/api/external-integration/v1/business/*`, schemas, auth, bindings, OpenAPI, testes | Fechada |
| 3 | Dashboard and financial states | dashboard com confirmado/pendente/vencido e atalhos principais | Fechada |
| 4 | Transactions and reminders UX | lista de transacoes e lembretes com estados operacionais e testes | Fechada |
| 5 | Assistant repositioning | copy consultiva, prompts melhores, gating de contexto rico, UX menos generica | Fechada com ressalvas |
| 6 | Plans and monetization | modelo Free/Pro, gating parcial em telas, admin/billing base | Parcial |

## Achados principais

### 1. Fase 1 agora pode ser considerada fechada

O intake unificado esta presente e a dependencia direta de segredo no frontend foi removida.

O item planejado `Gemini primario, OpenAI fallback` foi alinhado no backend:

- `backend/src/config/env.ts` agora usa `gemini` como provider primario por padrao
- `backend/src/services/ai/AIServiceFactory.ts` herda esse default
- `backend/src/config/ai.ts` foi ajustado para `Gemini -> OpenAI`

Veredito: fase 1 esta fechada no codigo, restando apenas observacao operacional de custo/fallback em ambiente real.

### 1.1 Categorizacao IA duplicada foi reduzida para um contrato unico

O gap de maior risco na trilha `0.8.x` era a duplicacao de logica de categorizacao entre:

- importacao via backend
- sugestao/superficie de IA no app
- fallback do motor financeiro

Agora existe um ponto canonico:

- `src/services/ai/categorizationService.ts`
- `src/services/ai/categorizationSchema.ts`

Esse contrato normaliza:

- categoria de produto (`Pessoal`, `Trabalho / Consultorio`, `Negocio`, `Investimento`)
- categoria detalhada do motor (`FinanceCategory`)
- tipo e confianca

E ele ja esta consumido por:

- `src/finance/importService.ts`
- `src/engines/finance/categorization/aiCategorizerFallback.ts`

Veredito: o backlog de "servico unico com contrato claro" pode ser considerado fechado no codigo.

### 2. Fase 2 esta bem fechada

Existe contrato de integracao de negocio com:

- payload minimo
- bloqueio de PII
- autenticacao de integracao
- binding por workspace/source
- documentacao OpenAPI
- testes dedicados

Veredito: fechada no codigo.

### 3. Fases 3 e 4 estao coerentes com o produto atual

Dashboard, transacoes e lembretes foram simplificados na direcao certa:

- estados financeiros mais claros
- menos ruido visual
- leitura mais operacional
- testes cobrindo a nova leitura

Veredito: fechadas no codigo.

### 4. Fase 5 esta boa, mas ainda ha pequenas sobras

O reposicionamento do assistente avancou de forma real:

- copy consultiva
- prompts orientados a decisao
- contexto com menos pretensao de "CFO magico"

Ressalvas:

- `Settings.tsx` ainda carrega uma superficie relativamente ampla para a etapa do produto
- parte da nomenclatura e da infraestrutura de IA ainda mistura geracoes antigas e novas

Veredito: fechada com ressalvas leves.

### 5. Fase 6 esta parcial

Ja existem:

- `monetizationPlan.ts`
- gating em `Insights`, `AICFO`, `Assistant`, `Autopilot` e `Analytics`
- `UpgradePromptCard`
- base de billing/admin no backend e frontend

O residual deixou de ser ausencia de gating nas principais superficies premium. O ponto aberto agora e verificar se ainda existe alguma superficie premium secundaria fora desse recorte e concluir o hardening final de ambiente/observabilidade.

Veredito: parcial.

## Checagens executadas nesta avaliacao

- `npm run lint`: aprovado
- `npm run test:coverage:critical`: aprovado
- `npx vitest run tests/unit/ai/categorizationService.test.ts tests/unit/import-service.test.ts tests/unit/assistant-copy.test.ts`: aprovado
- `npx playwright test tests/e2e/auth.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/billing.spec.ts --project=chromium --project=firefox --project=webkit --project='Mobile Chrome' --project='Mobile Safari' --workers=1 --reporter=line`: 36 passed, 4 skipped, 0 failed

## Atualizacao P0 desta sessao (2026-04-11)

1. Contrato canonico de categorizacao alinhado no codigo e no teste:
	- `normalizeToFinanceCategory` agora trata entradas compostas como `Trabalho / Consultorio`
	- expectativa de `financeCategory=servicos` para este caso ficou valida e verde
2. Microcopy consultiva padronizada com acentuacao (`pendencias` -> `pendências`) no assistente
3. Versao oficial reconciliada para `0.9.6` entre pacote e changelog

## Riscos de controle do projeto

1. `AGENTS.md` agora referencia explicitamente o vault canonico ativo fora do repo.
2. `ROADMAP.md` continua historico, mas passou a se declarar como nao-canonico para readiness de release.
3. A worktree atual esta suja demais para ser tratada como merge candidate confiavel.

## Veredito final

- `ate 0.6.x`: fechado
- `0.7.x`: implementado e muito perto de fechado, mas sem fechamento formal unificado
- `0.8.x`: fechado no nucleo tecnico, com risco residual operacional monitorado em ambiente real
- `0.9.x`: parcial, mas com matriz E2E principal validada, billing Stripe sandbox operacionalmente aprovado e login local de development cobrindo a trilha visual do admin

O projeto esta mais avancado no codigo do que a governanca documental deixa parecer, mas ainda nao esta consistente o suficiente para declarar a linha `0.9.x` como encerrada.
