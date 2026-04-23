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

Observacao:

- a validacao local de runtime foi aprovada
- o fechamento honesto no ambiente alvo ainda depende de variaveis corretas e de acesso de verificacao

### Backend

Estado:

- publicado no Vercel
- endpoints de saude e versao implementados com contrato novo de observabilidade

Observacao:

- a validacao externa continua bloqueada quando o preview esta protegido por Vercel Authentication
- sem acesso liberado, o teste automatizado nao consegue provar resposta real da aplicacao

### Billing

Estado:

- validado localmente em sandbox Stripe
- ainda depende de ambiente alvo acessivel para fechamento completo de deploy operacional

## Bloqueios atuais

1. Preview ou URL de validacao ainda protegido por autenticacao antes da aplicacao responder.
2. Variaveis de ambiente ainda pendentes no destino:
   - `VITE_SENTRY_DSN` (frontend preferencial)
   - `SENTRY_DSN` (backend e fallback legado do frontend no build)
   - `VITE_APP_VERSION`
   - `APP_VERSION`

## O que ja esta fechado

- `npm run test:coverage`
- `npm run test:coverage:critical`
- `npm run test:firestore:rules`
- login local de desenvolvimento sem Firebase configurado
- endpoints `/health`, `/api/health` e `/api/version` com `requestId` e `routeScope`
- bootstrap silencioso de Sentry sem DSN
- billing Stripe sandbox validado no nucleo critico

## O que falta para marcar o deploy como pronto

1. Preencher as variaveis de ambiente ausentes no Vercel.
2. Liberar ou compartilhar o preview protegido.
3. Executar:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

4. Confirmar resposta real da aplicacao em:
   - `/health`
   - `/api/health`
   - `/api/version`

## Referencias relacionadas

- [README.md](../README.md)
- [ROADMAP.md](./ROADMAP.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)

## Atualizacao de validacao - 2026-04-12 (rodada manual)

Comandos executados:
- `VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app/ npm run health:vercel`
- `VERCEL_TARGET_URL=https://flow-finance-frontend-nine.vercel.app/ npm run health:vercel`

Resultado:
- Backend: falha de contrato em `/health` sem `requestId/routeScope`.
- Frontend: `/health`, `/api/health` e `/api/version` retornando `404`.

Leitura operacional:
- O bloqueio de release permanece no alinhamento de ambiente alvo e contrato de observabilidade.
- Nao ha evidencia nova de regressao no nucleo de testes locais nesta rodada.

## Atualizacao de execucao - 2026-04-12 (backend corrigido)

Acoes executadas:
- Deploy de producao do projeto `flow-finance-backend` realizado no Vercel.
- `APP_VERSION` de producao ajustado para `0.9.6`.
- Revalidacao de endpoint publico de versao executada com sucesso.

Evidencia:
- `GET https://flow-finance-backend.vercel.app/api/version` retornando:
  - `version: 0.9.6`
  - `requestId` presente
  - `routeScope` presente
- `GET /health`, `GET /api/health` e `GET /api/version` no backend retornando `200` com contrato esperado.

Residual conhecido:
- O comando `npm run health:vercel` ainda falha no backend por considerar `GET /` como obrigatorio com `200`.
- No backend, `GET /` retornar `404` e esperado (nao ha rota raiz).

## Atualizacao de execucao - 2026-04-12 (gate backend aprovado)

Acoes executadas:
- Ajuste no validador `scripts/verify-vercel-observability.mjs` para aceitar `GET / = 404` quando o alvo for backend API-only com contrato estruturado.
- Teste unitario adicionado para a regra de API-only root (`tests/unit/verify-vercel-observability.test.ts`).

Validacoes executadas:
- `npx vitest run tests/unit/verify-vercel-observability.test.ts` -> aprovado
- `npm run lint` -> aprovado
- `npm test` -> aprovado
- `VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app/ npm run health:vercel` -> aprovado

Estado resultante:
- Backend oficial com contrato de observabilidade validado em `/health`, `/api/health` e `/api/version`.
- Falso negativo de `GET /` removido para contexto API-only.

## Atualizacao de execucao - 2026-04-12 (frontend versionado)

Acoes executadas:
- Variavel `VITE_APP_VERSION` ajustada para `0.9.6` no projeto `flow-finance-frontend`.
- Deploy de producao executado no frontend e alias aplicado em `https://flow-finance-frontend-nine.vercel.app/`.

Evidencia:
- `curl -I https://flow-finance-frontend-nine.vercel.app/` retornando `HTTP/1.1 200 OK`.

Observacao:
- O contrato de `/health` e `/api/*` permanece responsabilidade do backend (`flow-finance-backend`), nao do dominio de frontend estatico.


## Estado consolidado final - 2026-04-12

Resumo executivo atualizado:
- Backend (flow-finance-backend) validado com sucesso no gate de observabilidade:
  - /health 200
  - /api/health 200
  - /api/version 200
  - requestId e routeScope presentes
- Frontend (flow-finance-frontend) publicado e disponivel (HTTP 200) com VITE_APP_VERSION=0.9.6.
- APP_VERSION de producao no backend alinhado para 0.9.6.

Bloqueio residual real:
- SENTRY_DSN (backend) e VITE_SENTRY_DSN (frontend preferencial) ainda nao configurados nos projetos de producao.
- A aplicacao opera com bootstrap silencioso sem DSN, sem quebrar runtime.

Decisao operacional:
- GO WITH KNOWN LIMITATION para lancamento funcional.
- GO TOTAL depende apenas da ativacao dos DSNs e revalidacao final do monitoramento.

## Atualizacao final - 2026-04-15 (GO TOTAL)

Acoes executadas:
- `SENTRY_DSN` validado em producao no backend (`flow-finance-backend`).
- `VITE_SENTRY_DSN` validado no frontend (ou fallback legado via `SENTRY_DSN` quando necessario).
- Revalidacao final do contrato de observabilidade executada no backend oficial.

Evidencia tecnica:
- `GET https://flow-finance-backend.vercel.app/health` -> `200`
- `GET https://flow-finance-backend.vercel.app/api/health` -> `200`
- `GET https://flow-finance-backend.vercel.app/api/version` -> `200`
- `apiHealth.observability.sentryConfigured` -> `true`

Decisao operacional final:
- **GO TOTAL** confirmado para o ciclo atual.
- Sem bloqueios de release em aberto no contrato backend.

## Atualizacao de execucao - 2026-04-23 (CI verde + revalidacao)

Acoes executadas:
- Suite do GitHub Actions confirmada como `success` no branch `main` (Build & Test, Test Suite, CI/CD Pipeline e Deploy).
- Revalidacao do contrato do backend via `npm run health:vercel` apontando para:
  - `https://flow-finance-backend.vercel.app/`
- Check de disponibilidade do frontend por header HTTP:
  - `https://flow-finance-frontend-nine.vercel.app/` -> `200`
  - `https://flow-finance-xi.vercel.app/` -> `200`

Resultado observado (backend):
- `GET /` -> `404` esperado (API-only)
- `GET /health` -> `200` com `requestId` e `routeScope`
- `GET /api/health` -> `200` com `observability.sentryConfigured = true`
- `GET /api/version` -> `200` com `version = 0.9.6`

Leitura operacional:
- Estado do ciclo: `verde`.
- O backend continua cumprindo o contrato de observabilidade.
- O frontend esta publicado e acessivel nos dominios de referencia.


