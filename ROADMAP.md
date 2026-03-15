# FLOW FINANCE - ROADMAP OFICIAL

**Data:** 14 de Marco de 2026
**Status Atual:** v0.5.2v (Transicao iniciada; baseline tecnico em v0.6.x)
**Meta Estrategica:** v1.0 publico com AI Financial Assistant completo

## Visao por Fases

- `0.5.x` -> Hardening (qualidade e arquitetura)
- `0.6.x` -> Inteligencia financeira
- `0.7.x` -> Automacao financeira
- `0.8.x` -> Integracoes financeiras
- `0.9.x` -> Preparacao SaaS
- `1.0` -> Lancamento publico

---

## v0.5.x - Hardening (concluida)

### Objetivo
- arquitetura solida
- estabilidade operacional
- fundacao da IA

### Implementacoes concluidas
- Runtime Guard
- Domain Layer
- Event Bus
- AI Queue
- Autopilot Engine
- AI CFO Agent
- Repository Layer
- User Context
- Financial Event Pipeline
- Observability Metrics basico

### Score
- Atual: ~9.4
- Meta de fechamento da fase: ~9.6

---

## v0.6.x - Inteligencia Financeira (fase atual)

### Checkpoint 0.5.2v
- Protocolo de transicao formalmente iniciado e documentado
- Hardening de SaaS/services com `AppError`, validadores e repository de assinatura
- Observabilidade do orquestrador de IA estendida (call/error/latency)
- E2E Pluggy estabilizado para indisponibilidade local de backend (skip controlado)
- Lint, testes e cobertura critica aprovados no recorte protocolar
- Sprint 1 de hardening finalizada (A003-A006) com testes e build backend validados
- Sprint 2 iniciada com suíte de readiness cobrindo os 6 pilares da fase 0.6.x

### Checkpoint 0.6.3
- Event-driven listeners registrados (autopilot, AI queue, forecast, audit, cache)
- Cache financeiro Map-based com TTL e invalidacao reativa por prefixo
- AI Observabilidade avancada (buffer circular, MetricsViewer, resumos por tipo)
- Log estruturado de versao no bootstrap frontend e backend
- Lint verde, cobertura critica >= 98%
- D1 concluido: AI Context Builder avancado com score de confianca e qualidade de contexto
- D2 concluido: Pattern Detector com confianca por insight e testes de fronteira para picos/recorrencia

### Checkpoint 0.5.1v
- health checks de IO e runtime estabilizados no deploy
- Open Finance real com Pluggy, JWT, webhook protegido e persistencia Firebase
- PostgreSQL permanece opcional e desligado por padrao
- cobertura critica validada em `98.9%` branch no recorte protocolar

### 1. AI Context Builder avancado
Criar/fortalecer modulo em `src/engines/ai/contextBuilder` para consolidar:
- saldo atual
- padroes de gasto
- recorrencias
- metas
- perfil financeiro

### 2. Financial Pattern Detector
Novo modulo em `src/engines/finance/patternDetector` para detectar:
- gastos recorrentes
- assinaturas
- padroes semanais
- picos de gasto

### 3. Financial Timeline
Construir timeline financeira com:
- income
- expenses
- balance evolution

### 4. Perfis financeiros automaticos
Classificacao automatica:
- Saver
- Spender
- Balanced
- Risk Taker

### 5. Cashflow Prediction Engine
Previsoes orientadas por recorrencias e padroes para:
- 7 dias
- 30 dias
- 90 dias

### 6. Money Map
Distribuicao de gastos por categoria para:
- detectar categoria dominante
- alimentar memoria de gasto
- apoiar CFO e Autopilot

**Meta de fase:** melhorar qualidade de recomendacao e contextualizacao da IA.

---

## v0.7.x - Automacao Financeira

### 1. Financial Autopilot evolutivo
- detectar overspending
- sugerir cortes
- gerar alertas
- propor metas

### 2. Smart Budget
Orcamento automatico com base em:
- historico
- perfil financeiro
- objetivos

### 3. Smart Goals
Fluxos para metas como:
- economizar 20k
- pagar divida
- criar reserva

### 4. Orquestracao automatica de acoes
- executar recomendacoes com mais contexto
- priorizar alertas por risco e impacto

**Meta de fase:** sair de analise passiva para recomendacao ativa e acionavel.

---

## v0.8.x - Integracoes Financeiras

### 1. Importacao de extratos
Suporte para:
- OFX
- CSV
- PDF

### 2. OCR de recibos
Scanner para:
- notas fiscais
- boletos
- recibos

Extracao automatica:
- valor
- categoria
- data

### 3. Categorizacao automatica
Exemplos:
- Uber -> transporte
- iFood -> alimentacao

### 4. Detector de assinaturas
Deteccao de servicos como:
- Netflix
- Spotify
- Amazon

**Meta de fase:** conexao robusta com dados financeiros do mundo real.

---

## v0.9.x - Preparacao SaaS

### 1. Autenticacao completa
- JWT
- refresh tokens
- OAuth

### 2. Multi-tenant
Isolamento por:
- users
- accounts
- transactions

### 3. Cloud sync
Sincronizacao entre:
- web
- mobile

### 4. Billing (opcional)
Monetizacao com:
- Stripe
- assinatura premium

**Meta de fase:** prontidao de plataforma publica com isolamento e monetizacao.

---

## v1.0 - Lancamento Publico

### Features nucleares
- AI CFO
- Financial Autopilot
- Smart Goals
- Forecast
- OCR receipts
- Bank import

### Posicionamento
Flow Finance como **AI Financial Assistant**, mais proximo de:
- Copilot Money
- Monarch Money

**Nota geral projetada no fechamento da jornada:** `9.6+`

---

## Arquitetura-Alvo de Produto

Client
 |
Runtime Guard
 |
Frontend
 |
API
 |
User Context
 |
Domain
 |
Financial Engines
 |
AI Engines
 |
Autopilot
 |
AI CFO Agent
 |
Event Bus
 |
AI Queue
 |
Repositories
 |
Database
