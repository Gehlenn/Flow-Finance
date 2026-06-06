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
- houve warning residual de permissao Firestore no caminho legado de sync, mas ele nao bloqueou workspace, backend sync nem entrada na shell

### Backend

Estado:

- o contrato minimo de API esta acessivel no dominio oficial
- `/health`, `/api/health` e `/api/version` responderam `200` na revalidacao de `2026-05-25`
- backend oficial expoe `0.9.7` e esta alinhado com o repo atual

Observacao:

- o backend alvo nao esta fora do ar; o alinhamento de versao foi resolvido e resta fechar evidencias finais de readiness operacional
- `npm run health:vercel` ja confirma o contrato minimo atual
- a camada visual do frontend nao altera o contrato minimo do backend

### Billing

Estado:

- validado localmente em sandbox Stripe
- ainda depende de ambiente alvo acessivel para fechamento completo de deploy operacional

## Bloqueios atuais

1. Nenhum bloqueio publicado confirmado para o shell pos-signup
2. Manter acompanhamento do warning residual de permissao Firestore como item separado de hardening

## O que ja esta fechado

- `npm run build`
- `npm run lint`
- `npm run test:coverage:critical`
- `npm run test:backend`
- `npm run health:vercel`
- frontend principal respondendo `200` no dominio publico conhecido
- backend oficial respondendo o contrato minimo de observabilidade
- linha de polimento visual da interface principal concluida sem regressao funcional

## O que falta para marcar o deploy como pronto

1. Reexecutar a validacao externa em qualquer novo deploy relevante.
2. Executar:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

4. Confirmar resposta real da aplicacao em:
   - `/health`
   - `/api/health`
   - `/api/version` com a versao esperada

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

## Referencias relacionadas

- [README.md](../README.md)
- [ROADMAP.md](./ROADMAP.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
