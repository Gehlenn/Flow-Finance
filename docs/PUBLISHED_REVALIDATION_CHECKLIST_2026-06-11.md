# Flow Finance - published revalidation checklist

Data: 2026-06-11
Status: checklist operacional vivo para qualquer deploy que toque auth, billing, workspace, sync ou AI CFO.

## Papel deste documento

Este checklist existe para revalidar o ambiente publicado depois de mudancas sensiveis.

Ele nao substitui:

- a auditoria
- os gates externos historicos
- os testes locais

Ele responde apenas a pergunta: depois de um deploy sensivel, o publicado ainda esta usavel nos fluxos que mais quebram credibilidade?

## Quando rodar

Rodar este checklist sempre que houver deploy com mudanca em qualquer uma destas trilhas:

- auth
- cookies, sessao ou CSRF/origin
- workspace bootstrap ou persistencia
- sync pull ou sync client
- billing Stripe
- AI CFO com efeito em bootstrap, sessao ou fetch critico
- configuracao de deploy/env em Vercel

## O que nao conta como fechamento

- build local verde
- unit test verde sem artefato publicado
- smoke manual sem log ou arquivo salvo
- um unico `curl` bem sucedido enquanto o navegador publicado falha

## Sequencia minima obrigatoria

### 1. Contrato minimo do backend publicado

Comando:

```bash
VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app npm run health:vercel
```

Esperado:

- `/health` => `200`
- `/api/health` => `200`
- `/api/version` => `200`
- `workspacePersistence` presente quando aplicavel

Artefato:

- output do runner

Falha critica:

- backend servindo shell do frontend
- `/api/version` ausente
- health sem contrato minimo

### 2. Runtime web publicado

Comando:

```bash
npm run health:runtime
```

Esperado:

- sem erro critico de console
- shell principal carregando
- sem regressao visual impeditiva

Artefato:

- output do Playwright

Falha critica:

- pagina presa em loading
- erro de sessao sem mensagem
- console com erro impeditivo recorrente

### 3. Runtime mobile publicado

Comando:

```bash
npm run health:runtime:mobile
```

Esperado:

- shell mobile carregando
- CTA e navegacao sem sobreposicao impeditiva
- sem crash de console bloqueante

Artefato:

- output do Playwright mobile

Falha critica:

- bottom nav ou FAB encobrindo CTA principal
- tela inicial sem acao utilizavel

### 4. Bootstrap publicado de auth e workspace

Metodo:

- executar smoke em browser limpo contra o frontend oficial
- confirmar troca de sessao, leitura/criacao de workspace e sync inicial

Esperado no minimo:

- `POST /api/auth/firebase` => `200`
- `GET /api/workspace` => `200`
- `POST /api/workspace` => `201` quando for usuario novo
- `GET /api/sync/pull` => `200`
- `active_workspace_id` persistido quando aplicavel
- sem `consoleIssues`
- sem `pageErrors`

Artefato:

- JSON datado em `test-results/published-workspace-bootstrap/`
- screenshot datada quando a trilha exigir prova visual

Falha critica:

- `429` no caminho critico de bootstrap
- workspace nao persiste
- shell nao entra ou fica presa

### 5. Billing publicado, quando a mudanca tocar Stripe, plano ou workspace persistence

Comando:

```bash
npm run health:stripe-live-smoke
```

Esperado:

- artefato gerado em `test-results/stripe-live-smoke/`
- se houver credenciais e ambiente pronto, evidenciar checkout, webhook e plan sync
- se faltar precondicao, o runner deve bloquear explicitamente e dizer por que

Artefato:

- JSON datado em `test-results/stripe-live-smoke/`

Falha critica:

- checkout sem URL
- webhook recusado
- workspace perde plano ou billingCustomerId

### 6. Gates de evidencia que podem ser refresh, nao bloqueio imediato

Comandos:

```bash
npm run health:activation-retention:ready
npm run health:activation-retention:export
npm run health:activation-retention:refresh
npm run health:scale-readiness:ready
npm run health:target-performance -- --target-url https://flow-finance-frontend-nine.vercel.app
npm run health:activation-retention -- --input <export-real> --cohort-window-days <dias>
npm run health:scale-readiness
```

Uso correto:

- usar para renovar ou comparar evidencia existente
- nao tratar a simples execucao como fechamento automatico
- usar `health:activation-retention:ready` antes de um refresh de recorrencia quando houver duvida sobre backend/credenciais disponiveis
- usar `health:activation-retention:export` para gerar export autenticado novo antes do checker, quando a rodada exigir nova prova real
- usar `health:activation-retention:refresh` quando quiser uma leitura consolidada de bloqueio ou fechamento da rodada de recorrencia
- usar `health:scale-readiness:ready` antes do runner quando houver duvida sobre backend/credenciais disponiveis
- quando a mudanca tocar sync, auth publicada ou AI CFO, usar `health:scale-readiness` para manter `L2/L4` auditaveis
- para tentativa autenticada automatica do runner, definir `SCALE_READINESS_BACKEND_URL`, `SCALE_READINESS_EMAIL` e `SCALE_READINESS_PASSWORD`
- para tentativa autenticada automatica do export de recorrencia, definir `ACTIVATION_RETENTION_EXPORT_BACKEND_URL`, `ACTIVATION_RETENTION_EXPORT_EMAIL` e `ACTIVATION_RETENTION_EXPORT_PASSWORD`

Artefatos:

- `test-results/target-performance-evidence/`
- `test-results/activation-retention-evidence/`
- `test-results/activation-retention-export/`
- `test-results/scale-readiness-evidence/`

## Regra de decisao

### Pode seguir

- contrato minimo do backend verde
- runtime web e mobile sem bloqueio
- bootstrap publicado sem erro critico
- billing publicado validado ou explicitamente fora do escopo da mudanca

### Nao pode seguir

- health quebrado
- bootstrap quebrado
- workspace nao persiste
- billing tocado sem revalidacao correspondente

## Artefatos vivos de referencia

- `test-results/published-workspace-bootstrap/post-signup-nameflow-retry-1780712240110.json`
- `test-results/published-workspace-bootstrap/post-signup-nameflow-retry-1780712240110.png`
- `test-results/stripe-live-smoke/2026-06-05T02-27-29-531Z.json`
- `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json`
- `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json`

## Atualizacao obrigatoria apos cada rodada relevante

Se a revalidacao mudar o estado do publicado, atualizar:

- `docs/DEPLOYMENT_STATUS.md`
- `docs/GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md`, se alterar leitura de gate ou follow-up
- `docs/OPERATIONS_README.md`
