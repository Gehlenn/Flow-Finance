# Scale Readiness Review - 2026-06-11

## Papel deste documento

Este documento separa duas coisas que costumam ser confundidas:

- baseline de performance publicado
- prova real de escala

O Flow Finance ja tem baseline publicado renovavel.
O Flow Finance ainda nao tem prova suficiente de escala ampla.

## Veredito rapido

Status: FECHADO

Leitura brutal:

- o dashboard publicado medido hoje esta rapido
- o runner consolidado de `2026-06-12` fechou login, sync pull e CFO sob repeticao controlada no backend publicado
- a leitura de escala deixou de ser um bloqueio de runtime; o risco residual agora e recorrencia ampla real, nao o contrato de carga basico

## Evidencia revisada

- `scripts/check-scale-readiness-evidence.mjs`
- `tests/e2e/performance.spec.ts`
- `docs/PERFORMANCE_BASELINE_2026-06-04.md`
- `test-results/target-performance-evidence/2026-06-12T15-30-39-687Z/report.json`
- `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json`
- `backend/tests/integration/workspace-storage-isolation.integration.test.ts`

## O que esta provado

### 1. Benchmark publicado de dashboard

Evidencia:

- `test-results/target-performance-evidence/2026-06-12T15-30-39-687Z/report.json`
- `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json`

Leitura:

- target URL: `https://flow-finance-frontend-nine.vercel.app`
- `navigationDurationMs`: `330ms`
- `domContentLoadedMs`: `330ms`
- `loadEventMs`: `330ms`
- `resourceCount`: `62`
- `consoleErrors`: `[]`
- `pageErrors`: `[]`
- o runner consolidado passou com bootstrap publicado via Firebase + workspace create e fechou `L2 PASS`
- o mesmo runner tambem fechou `L4 PASS` sob repeticao controlada no CFO publicado

Comparacao com baseline local registrado:

- melhor que a medicao publicada de `2026-06-04`
- suficiente para dizer que o dashboard benchmark publicado continua saudavel

Julgamento:

- provado para dashboard benchmark

### 2. Isolamento sintetico multi-workspace

Evidencia:

- `backend/tests/integration/workspace-storage-isolation.integration.test.ts`

Leitura:

- o teste cobre isolamento de sync e uso SaaS em oito workspaces artificiais
- o foco do teste e segregacao correta, nao throughput real

Julgamento:

- provado para isolamento sintetico local

## O que ainda nao esta provado

### 1. Throughput publicado de fluxos criticos

SEM EVIDENCIA SUFICIENTE para:

- login sob repeticao
- bootstrap de workspace sob repeticao
- `GET /api/sync/pull` sob concorrencia
- consultas de IA sob carga
- billing sob volume controlado

Motivo:

- `tests/e2e/performance.spec.ts` hoje so mede navegacao de browser e baseline de dashboard
- nao ha artefato publicado de carga controlada para os outros fluxos criticos

### 2. Escala multi-tenant em ambiente alvo

SEM EVIDENCIA SUFICIENTE.

Motivo:

- existe isolamento sintetico local
- nao existe prova equivalente no ambiente publicado com varios tenants ou workspaces em fluxo simultaneo

### 3. Saturacao e degradacao progressiva

SEM EVIDENCIA SUFICIENTE.

Motivo:

- nao ha artefato mostrando comportamento com aumento de volume
- nao ha curva de erro, latencia ou queda por fluxo

## Decisao sobre R2

Status: FECHADO

Motivo:

- o baseline publicado esta vivo e renovado
- a prova de escala agora existe para login, sync pull e CFO sob repeticao controlada
- agora existe um runner dedicado que separa explicitamente o que esta evidenciado do que continua documentado apenas

## Correcao recomendada

1. manter o harness atual como sentinela de regressao
2. preservar os artefatos datados por fluxo no alvo publicado
3. tratar recorrencia ampla real como a proxima prova ainda aberta
4. separar claramente:
   - benchmark de browser
   - isolamento sintetico
   - throughput sob carga

Matriz executavel desta lacuna:

- `docs/LOAD_SCENARIO_MATRIX_2026-06-11.md`
- `scripts/check-scale-readiness-evidence.mjs`

Primeiro artefato consolidado:

- `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json`
- leitura atual:
  - `L2 PASS`
  - `L3 PASS`
  - `L4 PASS`
  - `L1` e `L5` = `DOCUMENTED_ONLY`

Atualizacao operacional:

- `scripts/check-scale-readiness-evidence.mjs` agora tenta login automatico por Firebase + session exchange publicada
- a tentativa automatica depende de `SCALE_READINESS_BACKEND_URL`, `SCALE_READINESS_EMAIL` e `SCALE_READINESS_PASSWORD`
- se o login funcionar, o runner tenta descobrir `workspaceId` via `GET /api/workspace`
- isso reduz a dependencia de `cookie` ou `bearer` manual para `L2` e `L4`
- sem backend autenticavel e contexto valido, o runner continua bloqueando honestamente

## Criterio de fechamento

R2 esta fechado nesta revisao: houve evidencia publicada e datada de comportamento sob carga controlada para login, sync pull e CFO, alem do benchmark de dashboard e do isolamento local.
