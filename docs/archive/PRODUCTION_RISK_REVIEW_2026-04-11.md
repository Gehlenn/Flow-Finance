# Revisao de Risco de Producao - Auth, Quota IA, Sync e Billing

Data: 2026-04-11  
Escopo: revisao tecnica de risco baseada no estado real do codigo

## Resumo

- Estado geral: controlado, com hardening relevante implementado.
- Risco residual: medio, concentrado em estrategia de conflito de sync, paridade de ambiente frontend/backend e observabilidade minima no alvo.
- Risco adicional de governanca: medio, relacionado a fonte de verdade documental.

## Status consolidado em 2026-04-11

A linha v0.9.x estava operacionalmente consistente no recorte validado, com auth, billing, sync e integracoes criticas cobertas.

Criterios de saida apontados naquele momento:

- alinhar endpoints e versionamento no ambiente de QA
- manter login local inseguro restrito a `development`
- preservar a matriz E2E como gate regressivo

Veredito historico:

v0.9.x estava consistente no recorte validado, mas ainda dependia de paridade de ambiente e observabilidade minima para fechamento final de release.

## 1. Auth, sessao e contexto de workspace

Status: mitigado

Evidencias principais:

- validacao forte de `JWT_SECRET` em producao
- middleware de auth com verificacao de JWT e `tokenType`
- middleware de `workspaceContext` exigindo `x-workspace-id` valido e membership

Riscos residuais:

- regressao entre modos de autenticacao
- necessidade de smoke de sessao em staging por release

## 2. Quota de IA

Status: mitigado com pontos de atencao

Evidencias principais:

- rate limit por plano e escopo
- retorno consistente de `429`
- trilha de auditoria para eventos de excedente

Risco residual:

- calibragem ainda dependente de telemetria real de uso

## 2.1. Prioridade de provider de IA

Status: mitigado

Evidencias principais:

- segredo fora do cliente
- suporte a provider primario e fallback no backend
- default alinhado para `Gemini -> OpenAI`

Risco residual:

- custo e taxa de fallback ainda dependem de observacao em ambiente real

## 2.2. Categorizacao por IA

Status: nucleo tecnico fechado, com residual operacional

Evidencias principais:

- servico canonico de categorizacao no frontend
- normalizacao de categorias para contrato unico
- importacao consumindo o contrato canonico
- testes cobrindo fallback e normalizacao

Risco residual:

- confianca OCR e casos ambiguos em ambiente real

## 3. Sync e conflitos

Status: mitigado com pontos de atencao

Evidencias principais:

- auth, workspace context e schema no sync
- policy explicita `client-updated-at-last-write-wins`
- retorno contratual de `conflictPolicy` e `conflicts`
- testes dedicados para stale write e empate de timestamp

Risco residual:

- ainda faltava evidencia consolidada de concorrencia sob carga real

## 4. Billing real e ambiente de execucao

Status: mitigado em sandbox e na UI local de `development`

Evidencias principais:

- endpoints de checkout, portal, webhooks e catalogo de planos
- wiring real do frontend para checkout e portal Stripe
- matriz Playwright validando auth, dashboard e billing
- evidencia operacional consolidada em `docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md`
- login local de `development` destravado quando Firebase nao esta configurado

Addendum de 2026-04-12:

- o bloqueio principal deixou de ser o nucleo do billing
- o residual passou a ser observabilidade minima no ambiente alvo
- Sentry sem DSN deixou de gerar ruido desnecessario

Riscos residuais:

- frontend local sem `VITE_FIREBASE_*` para repetir a trilha visual completa com login Firebase real
- necessidade de fechar a ultima validacao visual de auth/UI

## 4.1. Gating Free/Pro

Status: parcialmente mitigado

Evidencias principais:

- contrato centralizado em `src/app/monetizationPlan.ts`
- gating aplicado nas principais superficies premium
- testes dedicados para o plano de monetizacao

Risco residual:

- revisar superficies secundarias fora do recorte principal

## 5. Governanca documental e source of truth

Status: parcialmente mitigado

Evidencias principais:

- `AGENTS.md` apontando para o vault canonico
- `ROADMAP.md` marcado como historico
- versoes de pacote e changelog reconciliadas

Risco residual:

- manter disciplina para que roadmap historico nao volte a concorrer com a fonte operacional

## 6. Microcopy consultiva do assistente

Status: mitigado

Evidencias principais:

- copy sensivel centralizada
- testes dedicados contra regressao textual

## Classificacao final daquele corte

- Auth: medio
- Quota IA: baixo-medio
- Provider IA: baixo-medio
- Categorizacao IA: baixo-medio
- Sync e conflitos: medio
- Billing real: baixo-medio
- Governanca documental: baixo-medio

Risco agregado para a proxima release naquele recorte: medio

## Valor atual deste documento

Este material e uma fotografia tecnica do risco em 2026-04-11. Ele deve ser lido como registro historico datado, nao como fonte principal de status operacional.

Para o estado atual, usar em conjunto:

- [docs/DEPLOYMENT_STATUS.md](E:\app e jogos criados\Flow-Finance\docs\DEPLOYMENT_STATUS.md)
- [docs/VERCEL_CONFIG.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_CONFIG.md)
- [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](E:\app e jogos criados\Flow-Finance\docs\EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
