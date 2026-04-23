# Flow Finance - Vault (Decisoes e Contexto)

Este arquivo existe para registrar decisoes tecnicas e contexto de execucao que ajudam nas proximas sessoes.
Ele nao substitui o vault canonico fora do repositorio, mas serve como ponte rapida dentro do repo.

## 2026-04-23

### Decisao: desambiguar o AI orchestrator

Motivo:
- O projeto tem mais de um "orchestrator" de IA (caminhos diferentes), e o nome `runAIOrchestrator` era ambiguo.

Mudanca aplicada:
- `src/ai/aiOrchestrator.ts` passou a exportar `runLegacyAIOrchestrator` como funcao principal para o pipeline de eventos.
- `runAIOrchestrator` virou um alias de compatibilidade (marcado como deprecated) para evitar quebra em imports antigos.
- `src/events/eventEngine.ts` passou a importar explicitamente `runLegacyAIOrchestrator`.

Evidencia:
- Teste de regressao: `tests/unit/event-engine-orchestrator-routing.test.ts`

### Decisao: padronizar encoding e bloquear mojibake no repo

Motivo:
- Foram encontrados trechos com texto corrompido (mojibake) em UI/testes/comentarios, causando degradacao de UX e risco de "lixo" entrar em evidencia operacional.

Mudanca aplicada:
- Strings corrompidas corrigidas em UI e testes.
- Mensagem de erro de boot (fallback HTML) corrigida.
- `scripts/check-mojibake.mjs` passou a varrer o repositorio inteiro, ignorando diretorios pesados/gerados, para evitar regressao.

Evidencia:
- `npm run docs:check-mojibake` (repo inteiro)
- PR: https://github.com/Gehlenn/Flow-Finance/pull/40

### Decisao: versao do client no header (observabilidade)

Motivo:
- Evitar `X-Client-Version` hardcoded e manter alinhamento com `VITE_APP_VERSION` (deploy).

Mudanca aplicada:
- `src/config/api.config.ts` usa `VITE_APP_VERSION` com fallback.

Evidencia:
- Testes em `tests/unit/observability-client.test.ts`

## Proximos passos

- Continuar limpeza de segunda camada: remover arquivos/branches historicos que nao agregam, sem perder rastreabilidade.
- Manter docs do repo e vault canonico sincronizados para decisoes e mudancas de rumo.

