# Guia Rapido de Setup em PT-BR

## Papel deste documento

Este arquivo e um atalho curto. O documento canonico de setup e [SETUP_GUIDE.md](./SETUP_GUIDE.md).

Use este guia quando voce so precisa lembrar a sequencia pratica.

## Ordem recomendada

1. instalar dependencias
2. preencher variaveis locais minimas
3. subir frontend e backend
4. rodar checks criticos
5. so depois pensar em Vercel

## Comandos base

Instalacao:

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
