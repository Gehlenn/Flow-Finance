# Post-Audit Execution Plan - 2026-06-11

## Papel deste documento

Este documento registra a leitura operacional entre a auditoria tecnica ja executada, as evidencias publicadas e o fechamento dos pontos residuais. Ele nao substitui a auditoria principal em `docs/AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md`.

## Estado de partida

Fechado com evidencia revisada:

- billing publicado real
- bootstrap publicado real
- shell pos-signup publicado
- gate externo de activation/retention
- gate externo de performance
- hardening tecnico P1 auditado

Historicamente nao provado no ponto de partida:

- recorrencia ampla de uso
- comportamento em escala real
- disciplina duravel de foco do produto
- revalidacao repetivel a cada deploy sensivel

## Regra de leitura

Cada frente abaixo tem:

- objetivo
- evidencia minima
- o que nao conta como fechamento
- checklist executavel
- status

Sem evidencia, o item fica pendente no historico da frente.

---

## Frente R1 - Provar recorrencia ampla de uso

Status: CLOSED
Prioridade: P1
Risco principal: o produto pode funcionar tecnicamente e mesmo assim falhar por nao virar habito.

### Objetivo

Provar que o Flow Finance nao esta sendo usado apenas para ativacao inicial, mas para revisao recorrente de caixa.

### Evidencia minima

- exports reais e datados do ambiente publicado
- eventos reais ligados ao ritual semanal de caixa
- leitura por janela de tempo suficiente para mostrar repeticao, nao apenas primeira ativacao
- artefato revisado em `test-results/activation-retention-export/` ou sucessor equivalente

### O que nao conta como fechamento

- dados sinteticos
- seed local
- um unico workspace
- uma unica semana isolada
- teste unitario da medicao

### Checklist executavel

- [x] Expor no dashboard um ritual semanal visivel que registra `weekly_cash_review_completed`. Evidencia: `components/Dashboard.tsx`, `src/finance/weeklyCashReview.ts`, `tests/unit/dashboard-quick-actions.test.tsx`, `npm run build`, `npx tsc -p tsconfig.app.json --noEmit --pretty false`
- [x] Mitigar a tempestade publicada de `sync/pull` que estava queimando o bucket IP e contaminando `finance/events`. Evidencia: `src/services/workspaceSession.ts`, `src/services/localSyncService.ts`, `tests/unit/workspace-session.test.ts`, `tests/unit/localSyncService.test.ts`, `flow-finance-xi.vercel.app` revalidado sem a avalanche anterior de `429`
- [x] Confirmar que `weekly_cash_review_completed` continua chegando no backend publicado. Evidencia: `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json`, `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json` e `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
- [x] Exportar eventos reais normalizados com `node scripts/export-activation-retention-events.mjs`. Evidencia: `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json` e `test-results/activation-retention-export/published-export-verified.json`
- [x] Gerar artefato datado de recorrencia por janela semanal. Evidencia: `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
- [x] Adicionar preflight operacional para nao desperdiçar rodada sem contexto. Evidencia: `npm run health:activation-retention:ready` e `scripts/check-activation-retention-prereqs.mjs`
- [x] Consolidar um refresh runner publicado para recorrencia. Evidencia: `npm run health:activation-retention:refresh` e `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
- [x] Revisar se existe repeticao real de revisao semanal em mais de uma janela. Evidencia: o runner oficial publicado fechou `R1` com export `PASS`, checker `PASS` e refresh `PASS` em `2026-06-12`
- [x] Atualizar `docs/ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md` com a nova leitura
- [x] Atualizar `docs/AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md` quando houver prova suficiente ou falta persistente de prova. Evidencia: esta rodada consolidou o fechamento publicado de `R1`

### Criterio de saida

Esta frente fecha quando existir evidencia publicada e datada de repeticao do ritual de caixa em mais de uma janela observada.

Fechamento atual:

- `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json`
- `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json`
- `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
- `test-results/activation-retention-export/published-export-verified.json`

---

## Frente R2 - Provar comportamento em escala

Status: CLOSED
Prioridade: P1
Risco principal: o produto pode passar em smoke e quebrar quando houver uso simultaneo, sync repetido e consultas de IA mais frequentes.

### Objetivo

Medir o comportamento dos fluxos criticos em ambiente alvo sob carga controlada e sob cenarios multi-tenant mais proximos do uso real.

### Evidencia minima

- artefatos datados de carga ou benchmark
- alvo publicado identificado por URL e data
- cenarios cobrindo login, dashboard, workspace bootstrap, sync pull e consulta IA
- leitura separada entre isolamento de dados e throughput

### O que nao conta como fechamento

- apenas testes locais
- apenas teste de isolamento sem throughput
- apenas um smoke de navegador
- apenas healthcheck de endpoint

### Checklist executavel

- [x] Revisar o harness atual de performance e benchmark em `tests/e2e/performance.spec.ts`. Evidencia: `docs/SCALE_READINESS_REVIEW_2026-06-11.md`
- [x] Definir cenario de carga controlada para login, dashboard, sync pull e IA. Evidencia: `docs/LOAD_SCENARIO_MATRIX_2026-06-11.md`
- [x] Gerar artefato datado com alvo publicado. Evidencia: `test-results/target-performance-evidence/2026-06-11T03-23-06-276Z/report.json` e `test-results/scale-readiness-evidence/2026-06-11T16-19-10-643Z/report.json`
- [x] Separar resultados de latencia, erro e saturacao por fluxo. Evidencia atual: `scripts/check-scale-readiness-evidence.mjs` e `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json` deixam `L2 PASS`, `L3 PASS`, `L4 PASS` e `L1/L5 DOCUMENTED_ONLY`; o runner agora faz bootstrap publicado via Firebase + workspace create e confirma o CFO sob repeticao controlada no runtime publicado
- [x] Atualizar `docs/PERFORMANCE_BASELINE_2026-06-04.md` com a nova camada de evidencia
- [x] Atualizar `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md` se um fluxo exigir novo alerta ou novo kill switch. Evidencia: o fechamento consolidado de `R2` nao exigiu novo alerta nem novo kill switch

### Criterio de saida

Esta frente fecha quando existir evidencia publicada de comportamento sob carga controlada para os fluxos criticos, nao apenas baseline local.

Fechamento atual:

- `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json`

---

## Frente R3 - Blindar o foco do produto

Status: CLOSED
Prioridade: P1
Risco principal: o produto perder a tese de caixa para empresas de servico e voltar a parecer app financeiro generico com IA.

### Objetivo

Garantir que navegacao, copy, pricing, onboarding e dashboard continuem obedecendo ao core:

- caixa real
- previsto vs realizado
- recebiveis em risco
- proxima acao da semana

### Evidencia minima

- auditoria de superficie atualizada
- ausencia de promessas laterais no fluxo principal
- docs ativos alinhados ao core do produto

### Fechamento atual

- `docs/PRODUCT_FOCUS_SURFACE_REVIEW_2026-06-11.md`
- `src/app/mainNavigation.ts`
- `npx vitest run tests/unit/main-navigation.test.ts tests/unit/app-shell-navigation.test.tsx`
- `npx playwright test tests/e2e/performance.spec.ts tests/e2e/runtime-console-health.spec.ts --project=chromium --workers=1`

---

## Frente R4 - Tornar a revalidacao publicada repetivel

Status: CLOSED
Prioridade: P1
Risco principal: um deploy sensivel reabrir billing, auth, workspace persistence ou sync e a equipe perceber tarde demais.

### Objetivo

Padronizar uma rotina de revalidacao publicada para cada deploy que toque auth, billing, workspace, sync ou AI CFO.

### Fechamento atual

- `docs/PUBLISHED_REVALIDATION_CHECKLIST_2026-06-11.md`
- `docs/OPERATIONS_README.md`
- `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md`
- `docs/DEPLOYMENT_STATUS.md`
- `docs/GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md`

## Atualizacao de 2026-06-12 - published xi after activation fix

- [x] Remover o bloqueio publicado do primeiro lancamento causado por `payment_method: undefined`. Evidencia: `src/services/firestoreWorkspaceEntityWriteStore.ts`, `tests/unit/firestore-workspace-store.test.ts`, deploy `dpl_12mx8gQjJGYqZimSBhMrbHP2e3o8`, alias `flow-finance-xi.vercel.app`
- [x] Confirmar no runtime publicado que `activation_first_transaction` volta a ser persistido. Evidencia: browser-auth `GET /api/finance/events` no workspace `RbL6hMO4Smd9N0dg5ReA` retornou `activation_first_transaction` em `2026-06-12T20:12:42.183Z`
- [x] Fechar `R1` pelo runner oficial. Evidencia consolidada:
  - export PASS: `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json`
  - checker PASS: `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json`
  - refresh PASS: `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
  - verified handoff: `test-results/activation-retention-export/published-export-verified.json`
- [x] Tratar `/api/finance/events` publicado como durabilidade de backend, nao mais como risco de UI. Evidencia usada: `backend/src/services/finance/eventStore.ts`, `backend/src/services/finance/eventStoreFirestore.ts` e `backend/src/routes/finance.ts`

Leitura operacional:

- `R1` esta fechado no gate atual
- o resíduo honesto nao e mais de runner, store ou bootstrap; o resíduo agora volta ao risco de produto: ampliar recorrencia real ao longo do tempo, nao so reabrir a prova pontual
- historicos antigos escritos antes do hardening do event store nao foram backfillados do fallback local serverless e nao devem ser tratados como evidencia canonica

## Atualizacao de 2026-06-12 - backend event-store hardening and `R1` closure

- [x] Trocar o path publicado de eventos financeiros para store compartilhado duravel. Evidencia: `backend/src/services/finance/eventStore.ts`, `backend/src/services/finance/eventStoreFirestore.ts`, deploy `dpl_46ZmG79ppY9Vk3pDcBWKNUR3KN3g`, `/api/health` e `/health` com `domainEventPersistence = firebase / durable / required / healthy`
- [x] Falhar fechado quando o backend publicado nao tiver persistencia duravel de eventos. Evidencia: `backend/src/routes/finance.ts`, `backend/tests/unit/finance-route-durable-persistence.test.ts`, `backend/tests/unit/finance-route-domain-event-hardening.test.ts`
- [x] Fechar `R1` pelo runner oficial numa coorte publicada fresca. Evidencia:
  - export PASS: `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json`
  - checker PASS: `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json`
  - refresh PASS: `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
  - verified handoff: `test-results/activation-retention-export/published-export-verified.json`
- [x] Encerrar o bloqueio de consistencia do runner publicado para `/api/finance/events`. Evidencia: o mesmo runner saiu de `HTTP 500` e de historico divergente para `PASS` apos o hardening, usando o workspace publicado `ZcNI85emhBPTU02EeFPA`

Leitura operacional:

- `R1` esta fechado no gate atual
- `R2` continua fechado
- o resíduo honesto nao e mais de runner, store ou bootstrap; o resíduo agora volta ao risco de produto: ampliar recorrencia real ao longo do tempo, nao so reabrir a prova pontual
- nota importante: historicos antigos escritos antes do hardening do event store nao foram backfillados do fallback local serverless e nao devem ser tratados como evidencia canonica
- a trilha residual ativa agora esta em `docs/HABIT_PROOF_PROGRAM_2026-06-13.md` e no primeiro artefato longitudinal `test-results/habit-proof-evidence/2026-06-13T14-57-20-595Z/report.json`

---

## Ordem recomendada

1. R4 - repetibilidade operacional
2. R1 - recorrencia ampla
3. R3 - disciplina de foco
4. R2 - escala

## Leitura brutal

O produto nao esta mais travado por falha publicada obvia.
O risco agora mudou.

Se falhar daqui para frente, tende a falhar por um destes motivos:

1. nao virou habito
2. escalou mal
3. perdeu foco e virou ferramenta generica
4. reabriu problema sensivel em deploy e ninguem percebeu cedo
