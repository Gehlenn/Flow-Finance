# Checklist Priorizado - v0.7.x a v0.9.x

Data: 2026-04-11
Objetivo: transformar backlog em execucao auditavel
Escopo: refletir o estado real do codigo apos reavaliacao tecnica

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

Baseline pos-release consolidada:
- release 0.9.6 encerrada como GO WITH KNOWN LIMITATIONS
- recorte critico validado e registrado

Proximo gate de hardening (reducao de risco pos-release):
- fechar a paridade de ambiente para `API Guard` / `Version Guard` em execucoes frontend-only

Criterio de saida do gate de hardening:
- alinhar backend/version endpoint no ambiente de QA
- reduzir warnings `404` nao-funcionais em execucoes frontend-only
- consolidar evidencia unica de validacao adicional pos-release

Veredito atual:
v0.9.x segue operacionalmente consistente no recorte validado, com matriz E2E cross-browser/device executada, billing Stripe sandbox validado operacionalmente e risco residual pos-release concentrado em paridade de ambiente e observabilidade minima.

## Prioridade P0 (bloqueadores de readiness)

- [x] Enforce de `JWT_SECRET` forte em producao implementado em `backend/src/config/env.ts`
- [x] Quota obrigatoria para endpoints de IA implementada com `429` e headers de limite
- [x] Estrategia formal de conflito de sincronizacao implementada como `client-updated-at-last-write-wins`, com metadados de conflito no push e testes dedicados
- [x] Unificacao da logica de categorizacao IA em servico unico com contrato claro (`src/services/ai/categorizationService.ts` + `categorizationSchema.ts`)
- [x] Fechar lacunas E2E criticas no recorte priorizado (auth/dashboard/billing no Chromium)
- [x] Alinhar prioridade padrao de provider para `Gemini -> OpenAI fallback` conforme o plano
- [x] Reconciliar versao oficial do release entre `package.json` e `CHANGELOG.md` em `0.9.6`
- [x] Alinhar microcopy consultiva do assistente com contrato textual explicito (acentuacao padronizada)
- [x] Corrigir fonte de verdade documental (`AGENTS.md`, roadmap e vault canonico) com nota explicita de realidade documental e ponte para a trilha oficial atual

## Prioridade P1 (release hardening)

Nota de reconciliacao (worktree oficial): matriz oficial por superficie em `docs/HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md`.

- [x] Publicar runbook unico de transicao v0.9.x com gates de Go/No-Go (`docs/RUNBOOK_OPERACIONAL_v0.9.x_2026-04-11.md`)
- [x] Validar trilha de workspace admin/billing hooks em ambiente alvo
- [~] Revisar observabilidade minima: requestId, routeScope, erros de integracao (frontend ja promove contexto operacional e Sentry local ficou silencioso sem DSN; residual atual esta concentrado no ambiente alvo)
- [x] Tratar warnings de `API Guard` / `Version Guard` com backend ausente em execucao frontend-only
- [x] Congelar contratos HTTP sensiveis (auth, sync, finance/metrics, saas) - congelado no runtime spec; risco remanescente neste eixo e operacional/de ambiente. Fonte oficial: `docs/HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md`
- [ ] Validar cobertura critica em todo merge candidate
- [~] Propagar gating Free/Pro alem de `Insights`, `AICFO` e `smart alerts` - reconciliado no codigo para `Insights`, `AICFO`, `Assistant`, `Autopilot` e `Analytics`; residual atual e revisar se existe mais alguma superficie premium fora do fluxo principal
- [x] Unificar versao entre `package.json` e `CHANGELOG.md` (pendencia residual permanece apenas em governanca de checkpoints/roadmap)

## Prioridade P2 (evolucao controlada)

- [ ] Levar a matriz E2E multi-browser/device validada localmente para CI
- [ ] Consolidar backlog de UX para fluxos autenticados e administracao
- [ ] Revisar limites por plano com telemetria real de uso
- [x] Preparar trilha de billing real (Stripe) sem ativacao prematura - sandbox validado em checkout/webhook/portal; evidencia em `docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md`

## Distribuicao por versao

### v0.7.x (automacao financeira)

- [x] Automacoes de overspending/metas estao implementadas e registradas no changelog
- [x] Feedback de usuario e rastreabilidade de recomendacoes ja existem na trilha atual
- [ ] Consolidar aceite final da linha `0.7.x` em documento unico, sem depender de checkpoints dispersos

### v0.8.x (integracoes financeiras)

- [x] Intake unificado, scanner/backend proxy e contrato de integracao de negocio ja existem no codigo
- [x] Categorizacao IA agora passa por contrato canonico unico para importacao e sugestao
- [x] Divergencia do contrato canonico (`Trabalho / Consultorio` => `servicos`) resolvida com teste verde
- [x] Nucleo tecnico de importacao/OCR/categorizacao fechado no codigo e validado nos gates confiaveis
- [ ] Monitorar comportamento operacional em ambiente real (confianca OCR e casos ambiguos), sem backlog estrutural de codigo neste eixo
- [ ] Reduzir cenarios skipped em jornadas sensiveis

### v0.9.x (preparacao SaaS)

- [ ] Fechar backlog de hardening OWASP + escalabilidade
- [x] Auth/session, quota, tenant/workspace scope e billing base estao implementados
- [x] Trilha E2E focada de readiness (`auth`, `dashboard`, `billing`) validada no Chromium
- [x] Consolidar readiness operacional end-to-end (sync, billing real, admin e E2E) - auth/dashboard/billing cross-browser/device validados, billing Stripe sandbox provado e login local de development fechando a trilha visual do admin sem depender de Firebase

## Criterio de Pronto por item

Um item so pode ser marcado como concluido quando:

1. codigo/contrato estiver implementado
2. testes relevantes estiverem criados/atualizados
3. `npm run lint` estiver verde
4. `npm test` estiver verde
5. `npm run test:coverage:critical` estiver verde
6. evidencias documentadas em changelog/relatorio
