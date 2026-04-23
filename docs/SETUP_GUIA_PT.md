# Guia Rápido de Setup em PT-BR

## Papel deste documento

Este arquivo é um atalho curto. O documento canônico de setup é [SETUP_GUIDE.md](./SETUP_GUIDE.md).

Use este guia quando você só precisa lembrar a sequência prática.

## Ordem recomendada

1. instalar dependências
2. preencher variáveis locais mínimas
3. subir frontend e backend
4. rodar checks críticos
5. só depois pensar em Vercel

## Comandos base

Instalação:

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
