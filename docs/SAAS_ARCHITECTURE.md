# Arquitetura SaaS do Flow Finance

## Objetivo

Este documento resume a arquitetura SaaS adotada pelo Flow Finance, com foco em separacao de responsabilidades, integridade financeira, multi-tenant e capacidade de evolucao operacional.

## Visao em camadas

### 1. Dominio

Responsavel por entidades, regras de negocio e invariantes financeiras.

Exemplos de preocupacoes:

- validade de transacoes
- consistencia de contas e saldos
- classificacao de plano e gating de capacidades
- contratos de integridade financeira

### 2. Aplicacao

Coordena casos de uso e conecta dominio com infraestrutura.

Exemplos:

- fluxos de criacao e importacao de transacoes
- servicos de billing e catalogo SaaS
- orquestracao de AI, sync e auditoria

### 3. Infraestrutura

Implementa persistencia, integracoes externas, observabilidade e adaptadores concretos.

Exemplos:

- API backend
- storage local ou remoto
- Stripe
- Firebase quando habilitado
- logs, health checks e telemetria

## Principios arquiteturais

- separacao clara entre contrato e implementacao
- isolamento por workspace e contexto multi-tenant
- integridade financeira antes de conveniencia
- uso de eventos e auditoria para rastreabilidade
- possibilidade de fallback controlado em ambientes locais

## Modulos relevantes no projeto

### Frontend

- `src/app/`
- `src/services/`
- `src/saas/`
- `src/security/`
- `src/events/`

### Backend

- `backend/src/routes/`
- `backend/src/services/`
- `backend/src/middleware/`
- `backend/src/utils/`
- `backend/src/config/`

## Storage e persistencia

O projeto opera com abstracoes de persistencia para permitir:

- execucao local com baselines deterministicas
- execucao backend com stores dedicadas
- evolucao de drivers de persistencia sem reescrever a camada de negocio

## Eventos e reatividade

O uso de eventos permite:

- desacoplamento entre modulos
- processamento adicional sem poluir o caso de uso principal
- auditoria e rastreabilidade operacional
- invalidacao de cache e atualizacao de previsoes

## Seguranca e integridade

Pontos estruturais:

- JWT e escopo de workspace
- validacao de schema na borda
- trilhas de auditoria
- controles de quota e gating de plano
- contratos de sync com policy explicita

## Billing e monetizacao

O eixo SaaS atual se apoia em:

- catalogo de planos
- checkout e portal Stripe
- webhooks de conciliacao de assinatura
- reflexo do estado de billing no workspace
- gating Free/Pro no frontend

## Observabilidade

A operacao moderna depende de:

- health checks
- `requestId` e `routeScope`
- bootstrap de Sentry quando configurado
- logs e evidencia operacional por ambiente

## Leitura correta deste documento

Este texto e um mapa sintetico da arquitetura SaaS. Para estado de release, deploy, evidencias e riscos atuais, consultar:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/OPERATIONS_README.md`
- `docs/DEPLOYMENT_STATUS.md`
- `docs/AUDIT_AND_EVIDENCE_INDEX.md`

## Referencias tecnicas

- `backend/src/services/saas/`
- `src/saas/`
- `docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md`
