# Flow Finance - baseline operacional de performance

Data: 2026-06-04  
Status: harness de baseline criado; rodada local registrada em `test-results/performance-baseline/chromium-dashboard.json`; o gate externo de performance em ambiente alvo foi fechado com evidencia real em `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json` e `report.md`.

## Escopo

O baseline cobre tres frentes do MVP:

- dashboard e shell autenticado: carregamento do app, navegacao e metricas de browser
- IA consultiva: eventos de consulta concluida e fallback observado
- integracao: eventos externos com dedupe/auditoria e health dos endpoints relevantes

## O que existe agora

- `tests/e2e/performance.spec.ts` captura metricas de navegacao do browser.
- `src/runtime/benchmarkMode.ts` estabiliza sessoes de benchmark via query string `?bench`, `?benchmark` ou `?lh`.
- `src/app/productAnalytics.ts` possui eventos `ai_consultation_completed`, `ai_fallback_observed`, `weekly_cash_review_completed`, `billing_checkout_*` e `integration_error_observed`.
- `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md` define SLO alvo por fluxo.

## Como capturar baseline local

```bash
PERF_BASELINE_WRITE=1 npx playwright test tests/e2e/performance.spec.ts --project=chromium --workers=1
```

Evidencia local gerada em 2026-06-04:

- `test-results/performance-baseline/chromium-dashboard.json`

Saida esperada:

```text
test-results/performance-baseline/chromium-dashboard.json
```

O arquivo contem:

- `navigationDurationMs`
- `domContentLoadedMs`
- `loadEventMs`
- `resourceCount`

## Como validar sem escrever artefato

```bash
npx playwright test tests/e2e/performance.spec.ts --project=chromium --workers=1
```

Esse modo apenas prova que o browser expõe metricas de performance e que o app carrega em modo benchmark.

## O que ainda nao esta provado

- SEM EVIDENCIA SUFICIENTE de carga multi-tenant sintetica em ambiente alvo.
- SEM EVIDENCIA SUFICIENTE de custo por workspace e custo por resposta IA.
- O gate externo de performance do dashboard benchmark ja tem evidencia real; esta pagina continua sendo apenas o baseline local comparador.

## Runner de ambiente alvo

Agora existe um runner local para repetir o baseline no alvo e gravar comparacao auditavel. Em 2026-06-04 ele foi executado com sucesso e fechou o gate externo:

```bash
npm run health:target-performance -- --target-url https://flow-finance-app.vercel.app
```

Ou via env:

```bash
FLOW_LAUNCH_TARGET_URL=https://flow-finance-app.vercel.app npm run health:target-performance
```

Artefato esperado:

- `test-results/target-performance-evidence/<timestamp>/report.json`
- `test-results/target-performance-evidence/<timestamp>/report.md`

Sem URL alvo, baseline legivel ou medicao comparavel, o runner deve responder `BLOCK` com `SEM EVIDENCIA SUFICIENTE`.

Evidencia real capturada em 2026-06-04:

- target url: `https://flow-finance-frontend-nine.vercel.app`
- timestamp: `2026-06-04T22:01:40.962Z`
- artifact: `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json`
- report: `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.md`
- metrics: `navigationDurationMs 1656ms`, `domContentLoadedMs 1656ms`, `loadEventMs 1656ms`, `resourceCount 61`

Refresh publicado em 2026-06-11:

- target url: `https://flow-finance-frontend-nine.vercel.app`
- artifact: `test-results/target-performance-evidence/2026-06-11T03-23-06-276Z/report.json`
- report: `test-results/target-performance-evidence/2026-06-11T03-23-06-276Z/report.md`
- metrics: `navigationDurationMs 330ms`, `domContentLoadedMs 330ms`, `loadEventMs 330ms`, `resourceCount 62`
- leitura: o dashboard benchmark publicado segue saudavel, mas isso ainda nao prova throughput sob carga para login, bootstrap, sync pull ou IA

## Criterio atendido

1. Rodar o comando de baseline em ambiente alvo acessivel: concluido em 2026-06-04.
2. Anexar o JSON gerado a uma evidencia operacional: concluido com `report.json` e `report.md`.
3. Rodar `npm run health:runtime`, `npm run health:runtime:mobile` e `npm run health:vercel`: continua sendo um requisito operacional de validacao, mas nao impede o fechamento ja evidenciado do gate de performance.
4. Definir orcamentos de regressao com base nessa medicao real: agora possivel a partir da captura acima.
