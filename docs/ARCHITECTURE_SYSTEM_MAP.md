# Mapa Sistemico da Arquitetura

## Papel deste documento

Este documento resume o mapa de camadas do Flow Finance de forma visual e direta. Ele complementa a arquitetura principal, mas nao a substitui.

Referencia principal:

- [ARCHITECTURE.md](./ARCHITECTURE.md)

## Visao em camadas (alto nivel)

1. Cliente (Web/Mobile)
2. Guardas de runtime (resiliencia)
3. API (contratos e protecoes)
4. Contexto do usuario (sessao + workspace)
5. Dominio (regras de negocio)
6. Persistencia (stores)
7. Integracoes (Stripe, Sentry, IA, etc.)

## Diagrama simplificado

```mermaid
flowchart TD
  U[Usuario] --> C[Cliente: React/Vite + Capacitor]
  C --> G[Guardas de Runtime\n(API/Chunk/SW/Version)]
  G --> A[Backend API (Express)\n/auth /workspace /saas /ai /health /version]
  A --> CTX[Contexto\n(userId + workspaceId)]
  CTX --> D[Dominio\n(transacoes, cashflow, previsoes, IA consultiva)]
  D --> P[Persistencia\n(files/postgres/firestore - conforme configuracao)]
  A --> I[Integracoes\nStripe/Sentry/Providers IA]
```

## Camada 1 - Cliente (Web/Mobile)

Superficies atendidas:

- aplicacao web em React
- empacotamento mobile com Capacitor
- PWA quando aplicavel

Responsabilidades:

- renderizacao de interface
- entrada do usuario
- navegacao
- visualizacao de estado financeiro

## Camada 2 - Guardas de runtime

Componentes tipicos:

- API Guard (queda de API / indisponibilidade)
- Chunk Guard (assets quebrados)
- Service Worker Guard (quando aplicavel)
- Version Guard (build incompatvel)

Responsabilidades:

- reduzir falhas em runtime
- evitar inconsistencias entre deploys
- expor estado de readiness de forma objetiva

## Camada 3 - API

Entradas relevantes (exemplos):

- `/api/auth`
- `/api/workspace`
- `/api/transactions`
- `/api/ai`
- `/api/saas`
- `/api/health`
- `/api/version`

Responsabilidades:

- entrada de dados
- validacao
- autenticacao
- mediacao de fluxos sensiveis (billing, IA, integracoes)

## Camada 4 - Contexto do usuario

Dados principais:

- usuario ativo
- workspace ativo
- moeda e locale
- fuso horario

Funcao:

- garantir que o produto opere sempre no contexto correto
- impedir operacoes sensiveis sem `workspaceId` quando aplicavel

## Camada 5 - Dominio

Entidades e regras:

- transacoes e categorias
- leitura de cashflow e projeções
- operacao + vinculos com financeiro
- IA consultiva (gerar sinais e recomendacoes com rastreabilidade)

Regra:

- o dominio nao deve depender de detalhes de rede ou persistencia

## Camada 6 - Persistencia

Objetivo:

- armazenar dados por workspace com isolamento claro
- suportar auditoria operacional e rastreabilidade minima

Observacao:

- o projeto pode usar implementacoes diferentes por ambiente (dev vs deploy)

## Camada 7 - Integracoes

Exemplos:

- Stripe (checkout, webhook, portal)
- Sentry (observabilidade)
- Providers de IA (chaves e roteamento no backend)

Regras:

- integrar sem quebrar runtime quando variaveis nao existirem (bootstrap silencioso quando aplicavel)
- registrar evidencias e contratos sensiveis quando necessario

