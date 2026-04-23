# Guia de Deploy no Vercel

## Papel deste documento

Este guia descreve a execucao pratica de deploy e validacao no Vercel. Ele complementa `VERCEL_CONFIG`, mas nao repete toda a matriz de variaveis.

## Links oficiais conhecidos

- Frontend principal: https://flow-finance-frontend-nine.vercel.app/
- Backend principal: https://flow-finance-backend.vercel.app/
- Frontend alternativo: https://flow-finance-xi.vercel.app/

## Premissas

Antes de fechar qualquer deploy:

1. os checks criticos locais precisam estar verdes
2. as variaveis de ambiente precisam estar alinhadas
3. a URL alvo precisa estar acessivel para verificacao
4. health e version precisam responder a aplicacao real

## Comandos

Preview:

```bash
npm run deploy:preview
```

Producao:

```bash
npm run deploy
```

Validacao do alvo:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

## Interpretacao correta

Resultado util:

- `200` nas rotas esperadas
- `requestId` presente
- `routeScope` presente
- payload coerente de health e version

Resultado que nao fecha validacao:

- `blockedByVercelAuth=true`
- `401` antes da aplicacao responder
- HTML de autenticacao no lugar do app

## Fluxo recomendado

1. rodar checks locais criticos
2. publicar preview
3. revisar variaveis do frontend e backend
4. liberar acesso ao preview ou obter share URL
5. rodar `npm run health:vercel`
6. confirmar `/health`, `/api/health` e `/api/version`

## Bloqueio operacional atual

O principal bloqueio de validacao externa continua sendo:

- preview ou URL de verificacao protegida antes da aplicacao responder

Esse bloqueio invalida o fechamento do ambiente alvo mesmo quando o deploy existe.

## Referencias relacionadas

- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
