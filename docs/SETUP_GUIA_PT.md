# Guia RÃ¡pido de Setup em PT-BR

## Papel deste documento

Este arquivo Ã© um atalho curto. O documento canÃ´nico de setup Ã© [SETUP_GUIDE.md](./SETUP_GUIDE.md).

Use este guia quando vocÃª sÃ³ precisa lembrar a sequÃªncia prÃ¡tica.

## Estado vivo em 2026-05-25

- o deploy oficial atual ja esta fechado em `0.9.7`
- este atalho existe para setup e regressao, nao para diagnosticar o estado vivo do projeto


## Ordem recomendada

1. instalar dependÃªncias
2. preencher variÃ¡veis locais mÃ­nimas
3. subir frontend e backend
4. rodar checks crÃ­ticos
5. sÃ³ depois pensar em Vercel

## Comandos base

InstalaÃ§Ã£o:

```bash
npm ci
cd backend
npm ci
```

Frontend:

```bash
npm run dev
```

Backend:

```bash
cd backend
npm run dev
```

## Checks minimos

```bash
npm run lint
npm run test:coverage:critical
npm run health:runtime
npm run health:runtime:mobile
```

## Quando envolver Vercel

```bash
vercel login
vercel link
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

## Quando envolver Stripe sandbox

```bash
stripe login
stripe listen --forward-to http://localhost:3001/api/saas/stripe/webhook
```

## Referencias corretas

- Canonico: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- Deploy geral: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Vercel: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- Inicio rapido: [COMECE_AQUI.md](./COMECE_AQUI.md)
