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
- os envs criticos ja estao provisionados no Vercel; o fechamento honesto no ambiente alvo agora depende de acesso de verificacao e consolidacao da evidencia final
- o polimento visual principal foi fechado no repo sem impacto nos contratos de deploy
- a entrada do app foi conferida em desktop e mobile, confirmando que o acabamento final preserva hierarquia e leitura sem abrir regressao funcional

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

1. Consolidar a evidencia final de readiness no deploy publicado
2. Liberar ou compartilhar o preview protegido, quando aplicavel

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
2. Liberar ou compartilhar o preview protegido, quando aplicavel.
3. Executar:

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
- os envs criticos do projeto ja aparecem provisionados em producao; o que falta e fechar a trilha de evidencias

## Referencias relacionadas

- [README.md](../README.md)
- [ROADMAP.md](./ROADMAP.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
