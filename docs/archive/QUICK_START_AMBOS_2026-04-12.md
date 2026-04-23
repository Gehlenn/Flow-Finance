# Executar Ambos (Historico) - Sentry + Beta Testing

Data de referencia: 2026-04-12

## Contexto

Este documento e historico. Ele existiu como um "atalho operacional" para:

- ativar Sentry (quando DSNs existirem)
- iniciar beta testing (com scripts auxiliares)

O status operacional atual deve ser lido em:

- `docs/DEPLOYMENT_STATUS.md`
- `docs/VERCEL_CONFIG.md`
- `docs/SENTRY_SETUP.md`

## Opcao 1: Sentry (quando houver DSNs)

1. Criar 2 projetos no Sentry:
   - backend (Node.js)
   - frontend (React)
2. Copiar os DSNs.
3. Configurar variaveis no Vercel e validar `/api/health`.

## Opcao 2: Beta testing (iniciar imediatamente)

Executar o coordenador de beta:

```bash
node scripts/beta-testing-coordinator.mjs
```

Este script (na epoca) gerava:

- lista de testers
- templates de convite
- estrutura de feedback

## Opcao 3: Ambos em paralelo

Ordem sugerida (historica):

1. Rodar o coordinator de beta para capturar nomes/emails
2. Em paralelo, criar os 2 projetos no Sentry e obter DSNs
3. Configurar DSNs no ambiente e revalidar health

