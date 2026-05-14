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

- o dominio atual responde HTML na raiz e nao exp?e o contrato de API esperado
- `/health`, `/api/health` e `/api/version` retornam `404` na revalidacao de `2026-05-08`

Observacao:

- o backend alvo esta com contrato de rota desalinhado ou apontando para o deploy errado
- sem o contrato de API real, o teste automatizado nao consegue provar a aplicacao esperada
- a causa mais provavel e root directory/deploy apontando para o shell do frontend em vez de `backend/`
- `npm run health:vercel` agora evidencia explicitamente esse mismatch de shell do frontend

### Billing

Estado:

- validado localmente em sandbox Stripe
- ainda depende de ambiente alvo acessivel para fechamento completo de deploy operacional

## Bloqueios atuais

1. O backend alvo nao esta respondendo o contrato de API esperado.
2. Variaveis de ambiente ainda pendentes no destino:
   - `VITE_SENTRY_DSN` (frontend preferencial)
   - `SENTRY_DSN` (backend e fallback legado do frontend no build)
   - `VITE_APP_VERSION`
   - `APP_VERSION`
3. Corrigir o deploy/roteamento do backend para que o dominio de API volte a servir `/health`, `/api/health` e `/api/version`

## O que ja esta fechado

- `npm run test:coverage`
- `npm run test:coverage:critical`
- `npm run test:firestore:rules`
- login local de desenvolvimento sem Firebase configurado
- bootstrap silencioso de Sentry sem DSN
- billing Stripe sandbox validado no nucleo critico
- frontend principal ainda responde `200` no dominio publico conhecido
- o verificador `npm run health:vercel` agora diferencia `404` de API-only de dominio apontado para shell do frontend

## O que falta para marcar o deploy como pronto

1. Corrigir o roteamento ou o deploy do backend para expor o contrato de API esperado.
2. Garantir que o projeto Vercel do backend tenha root directory em `backend/`, nao no repo principal.
3. Preencher as variaveis de ambiente ausentes no Vercel.
4. Liberar ou compartilhar o preview protegido.
5. Executar:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

6. Confirmar resposta real da aplicacao em:
   - `/health`
   - `/api/health`
   - `/api/version`

## Revalidacao de 2026-05-08

- `https://flow-finance-backend.vercel.app/` retornou `200` com HTML
- `/health`, `/api/health` e `/api/version` retornaram `404`
- o verificador classificou o dominio como shell de frontend apontado no lugar do backend API-only

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
- Backend: a revalida??o atual retorna `404` em `/health`, `/api/health` e `/api/version`, enquanto `/` responde HTML.
- Frontend: permanece acessivel com `200`.

Leitura operacional:
- O bloqueio de release permanece no backend alvo que deixou de expor o contrato de observabilidade esperado.
- Nao ha evidencia nova de regressao no nucleo de testes locais nesta rodada.

## Atualizacao de execucao - 2026-04-12 (backend corrigido)

Acoes executadas:
- O deploy do backend foi validado historicamente, mas a revalidacao atual nao encontra mais o contrato de API esperado no dominio alvo.
- A versao do repo subiu para `0.9.7`, mas o backend publico atual nao est? expondo `/api/version` neste momento.

Evidencia:
- `GET https://flow-finance-backend.vercel.app/` retornando `200` com HTML
- `GET /health`, `GET /api/health` e `GET /api/version` retornando `404` na revalida??o atual

Residual conhecido:
- O comando `npm run health:vercel` agora aponta explicitamente quando o dominio backend parece servir o shell do frontend.
- O fato de `GET /` responder `200` com HTML e os endpoints de API retornarem `404` sugere alias/deploy errado, nao um API-only saudavel.

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
- A decis?o de `GO TOTAL` ficou historicamente registrada, mas a revalida??o atual do dom?nio backend n?o confirma mais o contrato de API esperado.
- O estado operacional atual exige corre??o de roteamento/deploy antes de reabrir o selo de aprova??o.

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
- Estado do ciclo: `parcial`.
- O frontend continua publicado e acessivel nos dominios de referencia.
- O backend atual precisa de revalidacao/redeploy porque nao exp?e mais o contrato de observabilidade esperado.

## Atualizacao de execucao - 2026-05-08 (revalidacao atual)

Acoes executadas:
- `VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app/ npm run health:vercel`
- `Invoke-WebRequest` ao frontend principal em `https://flow-finance-frontend-nine.vercel.app/`

Resultado observado:
- Backend:
  - `/` -> `200` com HTML
  - `/health` -> `404`
  - `/api/health` -> `404`
  - `/api/version` -> `404`
- Frontend principal:
  - `200`

Leitura operacional:
- O frontend segue publicado.
- O backend alvo continua desalinhado com o contrato de observabilidade esperado e nao deve ser tratado como pronto para fechamento de deploy operacional.


