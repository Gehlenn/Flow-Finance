# Status de Deploy - Flow Finance

## Papel deste documento

Este arquivo resume o estado real de deploy e publicacao do projeto. Ele nao substitui validacao operacional nem checks automatizados, mas serve como quadro rapido de situacao.

## Links de referencia

- Frontend principal: https://flow-finance-frontend-nine.vercel.app/
- Backend principal: https://flow-finance-backend.vercel.app/
- Frontend alternativo: https://flow-finance-xi.vercel.app/

## Situacao atual

### Frontend

Estado:

- publicado no Vercel
- acessivel nos dominios conhecidos
- alias publico `flow-finance-frontend-nine.vercel.app` revalidado em `2026-06-06`

Observacao:

- a validacao publicada do fluxo pos-signup agora esta fechada com evidencia real em `test-results/published-workspace-bootstrap/post-signup-nameflow-retry-1780712240110.json`
- nessa execucao real, `POST /api/auth/firebase` retornou `200`, `GET /api/workspace` retornou `200`, `POST /api/workspace` retornou `201`, `active_workspace_id` foi persistido e a shell autenticada abriu no dashboard
- a regressao de loading infinito pos-signup nao se reproduziu mais no alias publico
- em `2026-06-08`, o warning/page error `FirebaseError: Missing or insufficient permissions.` deixou de aparecer no runtime publicado apos a retirada dos caminhos legados de Firestore no sync, billing usage e fallback de workspace em producao
- em `2026-06-10`, a revalidacao publicada em browser limpo tambem deixou de reproduzir `429` no bootstrap auditado: `POST /api/auth/firebase` retornou `200`, `GET /api/workspace` retornou `200`, `POST /api/workspace` retornou `201`, `GET /api/sync/pull` retornou `200` e a pagina terminou no fluxo de nome inicial sem `consoleIssues` nem `pageErrors`

### Backend

Estado:

- o contrato minimo de API esta acessivel no dominio oficial
- em `2026-06-12`, `https://flow-finance-backend.vercel.app/health` e `/api/version` responderam `200`; `/api/workspace` respondeu `401` sem auth e `200` quando o runner publicou um contexto Firebase valido
- backend oficial expoe `0.9.7` e esta alinhado com o deploy promovido `dpl_46ZmG79ppY9Vk3pDcBWKNUR3KN3g`

Observacao:

- o backend alvo nao esta fora do ar; a publicacao de `2026-06-12` fechou a trilha de escala real e a rodada de `2026-06-12` tambem fechou `R1`; o que sobra e apenas risco de produto de longo prazo
- `npm run health:vercel` e `npm run health:scale-readiness` confirmam o contrato minimo e a resiliencia publicada atual
- a camada visual do frontend nao altera o contrato minimo do backend

### Billing

Estado:

- validado localmente em sandbox Stripe
- validado no ambiente publicado com checkout hosted real, webhook entregue, sincronizacao de plano e portal
- ainda requer revalidacao a cada mudanca relevante em billing, auth ou persistencia de workspace

## Bloqueios atuais

1. Nenhum bloqueio publicado confirmado para o shell pos-signup
2. Nenhum bloqueio publicado confirmado para billing/bootstrap no alias principal; seguir apenas com revalidacao em novos deploys relevantes

## O que ja esta fechado

- `npm run build`
- `npm run lint`
- `npm run test:coverage:critical`
- `npm run test:backend`
- `npm run health:vercel`
- frontend principal respondendo `200` no dominio publico conhecido
- backend oficial respondendo o contrato minimo de observabilidade
- bootstrap publicado auditado sem `429`, sem `consoleIssues` e sem `pageErrors` em `2026-06-10`
- linha de polimento visual da interface principal concluida sem regressao funcional

## O que falta para marcar o deploy como pronto

1. Reexecutar a validacao externa em qualquer novo deploy relevante seguindo `docs/PUBLISHED_REVALIDATION_CHECKLIST_2026-06-11.md`.
2. Executar:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

4. Confirmar resposta real da aplicacao em:
   - `/health`
   - `/api/health`
   - `/api/version` com a versao esperada

## Revalidacao publicada de 2026-06-10

- frontend principal: `https://flow-finance-frontend-nine.vercel.app/`
- backend principal: `https://flow-finance-backend.vercel.app/`
- deploy backend: `dpl_751avBUXL4BYVKwZquPVDgxpN2J4`
- deploy frontend: `dpl_33iCP5GZVAXfkB8wDKYiJW7Vvssy`
- smoke em browser limpo:
  - `POST /api/auth/firebase` -> `200`
  - `GET /api/workspace` -> `200`
  - `POST /api/workspace` -> `201`
  - `GET /api/sync/pull` -> `200`
  - `active_workspace_id` persistido: `uNnjpeqnpsFTjsLVc6WN`
  - estado visual final: fluxo de nome inicial renderizado
  - `consoleIssues: []`
  - `pageErrors: []`

Leitura operacional:

- o bootstrap publicado auditado voltou a ficar utilizavel sem ruido de rate limit no caminho critico
- o problema antigo de `429` ficou restrito ao desenho anterior de probes automatizados e nao se reproduziu apos o ajuste de rate limit/backend e dos guards de runtime no frontend
- `R2` e `R1` estao fechados por evidencia publicada; o risco residual agora e apenas de produto de longo prazo
- em `2026-06-11`, os runners residuais confirmaram que o shell atual ainda nao possui contexto autenticado publicado suficiente para refresh honesto dessas frentes:
  - `test-results/activation-retention-refresh/2026-06-11T16-53-01-310Z/report.json`
  - `test-results/scale-readiness-evidence/2026-06-11T16-25-19-359Z/report.json`
- em `2026-06-12`, o runner consolidado de escala fechou `L2 PASS`, `L3 PASS` e `L4 PASS` com bootstrap publicado via Firebase + workspace create; `L1/L5` seguem apenas documentados

## Revalidacao de 2026-05-25

- `https://flow-finance-backend.vercel.app/` -> `404` esperado (API-only)
- `https://flow-finance-backend.vercel.app/health` -> `200`
- `https://flow-finance-backend.vercel.app/api/health` -> `200`
- `https://flow-finance-backend.vercel.app/api/version` -> `200` com `version = 0.9.7`
- `https://flow-finance-frontend-nine.vercel.app/` -> `200`

Leitura operacional:

- o contrato minimo do backend foi restaurado e esta validavel externamente
- o alinhamento de versao publicada do backend foi fechado no deploy oficial
- os envs criticos do projeto ja aparecem provisionados em producao
- a trilha de evidencia do shell publicado pos-signup foi fechada em `2026-06-06`

## Revalidacao de 2026-06-12 (leitura intermediaria pre-hardening)

- backend principal: `https://flow-finance-backend.vercel.app/`
- deploy backend: `dpl_eu4as61w22UNLR4xzExTjgK4v1rK`
- `GET /health` -> `200`
- `GET /api/version` -> `200`
- `GET /api/workspace` -> `401` sem auth, `200` com contexto publicado
- `npm run health:scale-readiness` -> `PASS`
- `npm run health:activation-retention:refresh` -> `BLOCK` nessa leitura intermediaria, antes do hardening final do event store no mesmo dia

## Revalidacao de 2026-06-12 - backend event-store hardening

- backend principal: `https://flow-finance-backend.vercel.app/`
- frontend publicado usado no refresh: `https://flow-finance-xi.vercel.app/`
- deploy backend final desta rodada: `dpl_46ZmG79ppY9Vk3pDcBWKNUR3KN3g`
- `GET /api/health` -> `200` com `domainEventPersistence = firebase / durable / required / healthy`
- `GET /health` -> `200` com `checks.domainEventPersistence = healthy`
- `npm run health:activation-retention:refresh` -> `PASS`
- artefatos fechados:
  - `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
  - `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json`
  - `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json`
  - `test-results/activation-retention-export/published-export-verified.json`

Leitura operacional:

- o bloqueio publicado de integridade do event store foi fechado
- `R1` foi fechado pelo runner oficial e deixou de ser um problema de runner/store/bootstrap; o que sobra e apenas risco de produto de longo prazo
- historicos anteriores ao hardening do event store nao sao a base canônica da prova atual

## Referencias relacionadas

- [README.md](../README.md)
- [ROADMAP.md](./ROADMAP.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [PUBLISHED_REVALIDATION_CHECKLIST_2026-06-11.md](./PUBLISHED_REVALIDATION_CHECKLIST_2026-06-11.md)
- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
