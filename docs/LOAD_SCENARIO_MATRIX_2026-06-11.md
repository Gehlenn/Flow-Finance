# Load Scenario Matrix - 2026-06-11

## Papel deste documento

Este documento define o que precisa ser medido para o Flow Finance poder alegar evidencia de escala com seriedade.

Ele nao substitui benchmark de dashboard.
Ele complementa o que hoje falta provar.

## Regra de leitura

Cada fluxo abaixo precisa de:

- alvo publicado identificado
- volume controlado
- artefato datado
- separacao entre sucesso, erro e degradacao

Sem isso, continua `SEM EVIDENCIA SUFICIENTE`.

Runner atual desta matriz:

```bash
npm run health:scale-readiness
```

Artefato consolidado atual:

- `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json`

Leitura atual do runner:

- `L1` = `DOCUMENTED_ONLY`
- `L2` = `PASS`
- `L3` = `PASS`
- `L4` = `PASS`
- `L5` = `DOCUMENTED_ONLY`

## Bootstrap automatico do runner

O runner agora tenta reduzir dependencia manual para `L2` e `L4`.

Se `cookie`, `bearer` ou `workspaceId` nao estiverem definidos, ele tenta:

1. autenticar via Firebase web sign-in / sign-up usando `VITE_FIREBASE_API_KEY`
2. trocar o `idToken` em `POST /api/auth/firebase`
3. ler `GET /api/workspace`
4. criar `POST /api/workspace` quando o usuario nao tiver workspace ainda
5. reutilizar cookie de sessao ou token retornado para medir `sync pull` e `AI CFO`

Variaveis preferenciais:

- `SCALE_READINESS_BACKEND_URL`
- `SCALE_READINESS_EMAIL`
- `SCALE_READINESS_PASSWORD`
- `SCALE_READINESS_WORKSPACE_ID` opcional
- `SCALE_READINESS_COOKIE_HEADER` opcional
- `SCALE_READINESS_BEARER_TOKEN` opcional

Sem pelo menos backend autenticavel e credenciais validas, o runner continua bloqueando honestamente.

## Fluxos prioritarios

### L1. Auth bootstrap publicado

Objetivo:

- provar que login e bootstrap nao degradam cedo com repeticao controlada

Contrato minimo:

- `POST /api/auth/firebase`
- `GET /api/workspace`
- `POST /api/workspace` para usuario novo quando aplicavel
- persistencia de `active_workspace_id`

Sinais a medir:

- latencia por tentativa
- taxa de erro
- ocorrencia de `429`
- ocorrencia de `pageErrors` e `consoleIssues`

Artefato esperado:

- JSON datado em `test-results/published-workspace-bootstrap/`

### L2. Sync pull publicado

Objetivo:

- provar que `GET /api/sync/pull` continua utilizavel com repeticao controlada

Contrato minimo:

- `GET /api/sync/pull` => `200`
- payload coerente por workspace

Sinais a medir:

- latencia por chamada
- taxa de erro
- degradacao por repeticao
- isolamento por workspace

Artefato esperado:

- JSON datado por rodada

### L3. Dashboard benchmark publicado

Objetivo:

- manter baseline vivo do shell principal

Contrato minimo:

- benchmark `?bench=dashboard`
- sem `consoleErrors`
- sem `pageErrors`

Sinais a medir:

- `navigationDurationMs`
- `domContentLoadedMs`
- `loadEventMs`
- `resourceCount`

Artefato esperado:

- `test-results/target-performance-evidence/<timestamp>/report.json`

Estado atual:

- evidenciado

### L4. Consultor IA sob repeticao controlada

Objetivo:

- provar que a consulta consultiva continua respondendo ou caindo em fallback explicito quando houver repeticao

Contrato minimo:

- resposta concluida com `ai_consultation_completed`
ou
- fallback explicito com `ai_fallback_observed`

Sinais a medir:

- taxa de resposta concluida
- taxa de fallback
- latencia
- erro de backend `ai_cfo_request_failed`

Artefato esperado:

- export datado de eventos e logs por rodada

### L5. Billing e workspace persistence apos checkout

Objetivo:

- garantir que billing nao parece bom no checkout e falha na reconciliacao do workspace

Contrato minimo:

- checkout URL valida
- webhook aceito
- workspace refletindo plano esperado
- portal abrindo

Sinais a medir:

- taxa de erro por etapa
- perda de `workspaceId`
- perda de `billingCustomerId`

Artefato esperado:

- `test-results/stripe-live-smoke/<timestamp>.json`

## Ordem recomendada

1. L1 auth bootstrap
2. L2 sync pull
3. L4 consultor IA
4. L5 billing persistence
5. L3 dashboard benchmark como sentinela continua

## O que nao conta como prova de escala

- um unico benchmark de dashboard
- testes locais isolados
- um teste de isolamento multi-workspace sem throughput
- healthcheck de endpoint
- ausencia de erro em uma unica tentativa manual
