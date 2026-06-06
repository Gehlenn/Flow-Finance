# Flow Finance - target performance evidence runner

Data: 2026-06-04  
Status: runner local e registro da evidencia do terceiro gate externo de performance em ambiente alvo. O PASS real de 2026-06-04 fechou o gate.

## Gate canonico

O gate externo continua sendo **Performance in target environment**, conforme `docs/GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md`, e a evidencia abaixo registra o fechamento real desse gate.

Este documento descreve o runner local `npm run health:target-performance`, que existe para capturar evidencia auditavel do baseline repetido em ambiente alvo sem tocar no runtime de producao. Uma execucao real em 2026-06-04 capturou o PASS que fechou o gate.

## Objetivo do runner

- exigir URL alvo e baseline local valido
- abrir o dashboard em modo benchmark no alvo usando a mesma rota da bateria local
- capturar as metricas de navegacao do browser de forma rastreavel
- escrever artefato datado em `test-results/target-performance-evidence/`
- comparar o alvo com o baseline local de forma simples, sem inventar um SLO historico
- falhar com `BLOCK` quando faltar URL, baseline, medicao comparavel ou quando o dashboard benchmark nao puder ser confirmado

O runner nao deve gerar `PASS` falso. Sem baseline local legivel, sem URL alvo ou sem medicao comparavel do dashboard, o resultado continua bloqueado com o texto `SEM EVIDENCIA SUFICIENTE`.

## Evidencia capturada

- timestamp: `2026-06-04T22:01:40.962Z`
- target url: `https://flow-finance-frontend-nine.vercel.app`
- benchmark url: `https://flow-finance-frontend-nine.vercel.app/?bench=dashboard`
- result: `PASS`
- comparison: `navigationDurationMs +1119 ms (+208.38%) | domContentLoadedMs +1121 ms (+209.53%) | loadEventMs +1119 ms (+208.38%) | resourceCount -117 count (-65.73%)`
- metrics: `navigationDurationMs 1656ms`, `domContentLoadedMs 1656ms`, `loadEventMs 1656ms`, `resourceCount 61`

## Entradas aceitas

### URL alvo

Ordem de resolucao:

1. `--target-url`
2. `FLOW_LAUNCH_TARGET_URL`
3. `VERCEL_TARGET_URL`

O runner abre o alvo com `/?bench=dashboard`, que e a mesma chave de benchmark usada pelo harness local em `tests/e2e/performance.spec.ts`.

### Baseline local

Ordem de resolucao:

1. `--baseline`
2. `TARGET_PERFORMANCE_BASELINE_PATH`
3. `test-results/performance-baseline/chromium-dashboard.json`

O baseline precisa existir, ser JSON valido e conter as metricas de dashboard esperadas.

### Saida auditavel

Ordem de resolucao:

1. `--output-dir`
2. `TARGET_PERFORMANCE_EVIDENCE_OUTPUT_DIR`
3. `test-results/target-performance-evidence/`

O runner cria uma subpasta com timestamp a cada execucao.

## Contrato de execucao

Quando o alvo e o baseline estiverem presentes, o runner faz uma navegacao real para o dashboard benchmark e coleta as mesmas metricas do harness local:

- `navigationDurationMs`
- `domContentLoadedMs`
- `loadEventMs`
- `resourceCount`

Depois ele compara cada campo com o baseline local e grava a diferenca absoluta e percentual. A comparacao e propositalmente simples; ela existe para gerar evidencia auditavel, nao para substituir o runbook de SLO.

## Artefato gerado

Saida principal:

- `test-results/target-performance-evidence/<timestamp>/report.json`

Saida humana auxiliar:

- `test-results/target-performance-evidence/<timestamp>/report.md`

O artefato inclui:

- timestamp da execucao
- URL alvo e origem da entrada
- baseline local usado, com hash e caminho
- URL de benchmark efetivamente aberta
- medicao alvo
- comparacao simples por metrico
- resultado final `PASS` ou `BLOCK`

## Criterio de leitura

- `BLOCK` significa que a evidencia ainda nao fecha o fluxo.
- `SEM EVIDENCIA SUFICIENTE` e a frase obrigatoria quando faltar URL, baseline, benchmark valido ou comparacao util.
- `PASS` significa que o runner conseguiu capturar a medicao do dashboard no alvo e comparar com o baseline local; neste documento, esse PASS e a evidencia que fecha o gate externo quando referenciado nos docs operacionais.

## Relacao com os docs canonicamente relevantes

- `docs/PERFORMANCE_BASELINE_2026-06-04.md`
- `docs/GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md`
- `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md`
- `tests/e2e/performance.spec.ts`

Esses arquivos definem a mesma regiao do produto: baseline local, gate externo e harness de browser. Este runner apenas operacionaliza a repeticao em ambiente alvo com evidencia datada.
