ï»¿# FLOW FINANCE â€” ROADMAP (v0.9.1)

**Data:** 2026-04-02
**Status:** TransiÃ§Ã£o v0.9.1 iniciada
**Objetivo:** prontidÃ£o SaaS segura para Web (Vercel) e Mobile (iOS/Android)

## Prioridades 0.9.1 â†’ 0.9.3

1. **Auth & SessÃ£o de ProduÃ§Ã£o**
   - Migrar mock local para Auth real (Firebase Auth/Clerk/Auth.js)
   - Refresh token seguro, rotaÃ§Ã£o e revogaÃ§Ã£o

2. **Multi-tenant e Isolamento de Dados**
   - Modelo tenant-aware obrigatÃ³rio em leitura/escrita
   - Auditoria de autorizaÃ§Ã£o por workspace

**Data:** 17 de MarÃ§o de 2026
**Status Atual:** v0.9.1v (transiÃ§Ã£o auditada com foco em hardening SaaS e QA)
**Meta Estrategica:** v1.0 publico com AI Financial Assistant completo

4. **IA Financeira ConfiÃ¡vel**
   - Mover chamadas de IA para backend/proxy seguro
   - ClassificaÃ§Ã£o com score de confianÃ§a + fallback determinÃ­stico

5. **Qualidade e Observabilidade**
   - Cobertura mÃ­nima de 98% em escopo crÃ­tico
   - SLO de erro e latÃªncia para fluxos de saldo e sincronizaÃ§Ã£o

## Marcos

**Mudancas:**
- Endpoint `/api/banking/*` retorna HTTP 503 Service Unavailable quando `DISABLE_OPEN_FINANCE=true`
- Middleware `featureGateOpenFinance` em `backend/src/middleware/featureGate.ts`
- Flag obrigatoria em `backend/.env` para reativacao; padrÃ£o = desativado
- Codigo fonte mantido para reativacao zero-effort

**Impacto:**
- âœ… Stripe Billing: Desativado tambem (pular por enquanto; manter mock billing sim)
- âœ… Core IA: Intacto (AI Context Builder, Pattern Detector, Timeline, Classifier)
- âœ… Testes: Validados pÃ³s-desativacao sem regressao
- âœ… Caminho crÃ©dito/dÃ©bito: Funciona via entrada manual + IA

---

## Visao por Fases

- `0.5.x` -> Hardening (qualidade e arquitetura)
- `0.6.x` -> InteligÃªncia financeira (concluÃ­da)
- `0.7.x` -> AutomaÃ§Ã£o financeira (Autopilot evolutivo: recomendaÃ§Ãµes ativas, overspending, metas automÃ¡ticas)
- `0.8.x` -> Integracoes financeiras
- `0.9.x` -> Preparacao SaaS
- `1.0` -> Lancamento publico

---

## v0.7.x - AutomaÃ§Ã£o financeira (em andamento)

### Objetivo
- Evoluir o Autopilot para detectar overspending em tempo real por categoria
- Gerar recomendaÃ§Ãµes ativas e sugestÃµes de corte automÃ¡ticas (com valor sugerido por categoria dominante)
- Criar metas automÃ¡ticas de corte, economia e reserva de emergÃªncia baseadas em comportamento/histÃ³rico
- Enriquecer feedback e acompanhamento de resposta do usuÃ¡rio

### ImplementaÃ§Ãµes
- Engine do Autopilot ampliada para detecÃ§Ã£o de overspending por categoria, sugestÃ£o de corte automÃ¡tico e metas automÃ¡ticas
- Testes unitÃ¡rios e cobertura crÃ­tica validados (>98%)
- DocumentaÃ§Ã£o e changelog atualizados

---

## v0.6.x - Inteligencia Financeira (fase anterior)

### Checkpoint 0.5.2v
- Protocolo de transicao formalmente iniciado e documentado
- Hardening de SaaS/services com `AppError`, validadores e repository de assinatura
- Observabilidade do orquestrador de IA estendida (call/error/latency)
- E2E Pluggy estabilizado para indisponibilidade local de backend (skip controlado)
- Lint, testes e cobertura critica aprovados no recorte protocolar
- Sprint 1 de hardening finalizada (A003-A006) com testes e build backend validados
- Sprint 2 iniciada com suÃ­te de readiness cobrindo os 6 pilares da fase 0.6.x

### Checkpoint 0.6.3
- Event-driven listeners registrados (autopilot, AI queue, forecast, audit, cache)
- Cache financeiro Map-based com TTL e invalidacao reativa por prefixo
- AI Observabilidade avancada (buffer circular, MetricsViewer, resumos por tipo)
- Log estruturado de versao no bootstrap frontend e backend
- A004 concluido: logger com sink estruturado no Sentry, redaction e fallback em console
- Lint verde, cobertura critica >= 98%
- D1 concluido: AI Context Builder avancado com score de confianca e qualidade de contexto
- D2 concluido: Pattern Detector com confianca por insight e testes de fronteira para picos/recorrencia

### Checkpoint 0.6.4
- D3 concluido: Financial Timeline Engine â€” `aggregateByMonth`, `detectBalanceTrend` (regressao linear), `detectTimelineAnomalies` (2x mediana)
- D4 concluido: Financial Profile Classifier â€” confidence, topCategories, insights acionaveis, perfil `Undefined`
- A004 lint fix: `AICFOAgent.ts` importa `FinancialProfile` centralizado
- 377/377 testes; cobertura critica 99.76%/98.3%

### Checkpoint 0.6.5 (atual)
- D5 concluido: Widget de Inteligencia Financeira no Dashboard â€” tendencia, perfil, confidence, insights, anomalias
- D6 concluido: Endpoint backend `POST /api/finance/metrics` com auth e validacao
- D7 concluido: Fixture E2E Pluggy com email fixo via env var (fix intermitencia B010-E2E)
- 387/387 testes; cobertura critica 99.76%/98.3%; lint verde

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


### 3. CategorizaÃ§Ã£o automÃ¡tica e ediÃ§Ã£o inteligente
- SugestÃ£o automÃ¡tica de categoria por IA ao editar transaÃ§Ã£o (merchant-aware)
- Modal de ediÃ§Ã£o com botÃ£o "Desfazer" para restaurar categoria anterior
- Feedback visual e acessibilidade aprimorados
- Cobertura de testes unitÃ¡rios e E2E para todo o fluxo
Exemplos:
- Uber -> transporte
- iFood -> alimentaÃ§Ã£o

### 4. Detector de assinaturas
Deteccao de servicos como:
- Netflix
- Spotify
- Amazon

**Meta de fase:** conexao robusta com dados financeiros do mundo real.

---


## v0.9.x - PreparaÃ§Ã£o SaaS

### Checkpoint 0.9.1v (02/04/2026)
- Auditoria sistÃªmica concluÃ­da com priorizaÃ§Ã£o de riscos OWASP e escalabilidade.
- Cobertura crÃ­tica validada com baseline acima da meta protocolar no recorte sensÃ­vel.
- Regressao unitaria/integrada aprovada; regressao E2E aprovada apos estabilizacao de runtime/configuracao.
- Backlog imediato de hardening para release:
	- sanitizaÃ§Ã£o de entrada em campos livres de transaÃ§Ã£o
	- enforce de `JWT_SECRET` forte em produÃ§Ã£o
	- quota obrigatÃ³ria para endpoints de IA
	- estratÃ©gia formal de resoluÃ§Ã£o de conflitos de sincronizaÃ§Ã£o
	- unificaÃ§Ã£o da lÃ³gica de categorizaÃ§Ã£o IA em serviÃ§o Ãºnico

### 1. AutenticaÃ§Ã£o completa
- JWT
- refresh tokens
- OAuth

### 2. Multi-tenant e AdministraÃ§Ã£o
- Isolamento de dados por workspace/empresa
- Painel de administraÃ§Ã£o (gestÃ£o de usuÃ¡rios, planos, auditoria)
- Logs de auditoria detalhados (aÃ§Ãµes do usuÃ¡rio, alteraÃ§Ãµes sensÃ­veis)
- PolÃ­tica de retenÃ§Ã£o e exclusÃ£o de dados (LGPD/GDPR)

### 3. Plano de assinatura e billing real
- Stripe, recorrÃªncia, trial, downgrade/upgrade
- ExportaÃ§Ã£o de dados (PDF, Excel, integraÃ§Ã£o contÃ¡bil)

### 4. NotificaÃ§Ãµes e alertas
- NotificaÃ§Ãµes push/email para eventos crÃ­ticos (ex: saldo baixo, meta atingida)

### 5. Monitoramento e seguranÃ§a
- Monitoramento de performance e uptime (SLA pÃºblico)
- Plano de disaster recovery e backup automatizado
- CertificaÃ§Ã£o de seguranÃ§a (OWASP, testes de penetraÃ§Ã£o)

---

## v1.0 - LanÃ§amento PÃºblico

- Onboarding guiado e tour interativo
- FAQ e central de ajuda integrada
- IntegraÃ§Ã£o com marketplaces de apps (Google Play, App Store, Vercel, etc.)
- Canal de feedback do usuÃ¡rio e NPS

---

## PÃ³s v1.0 - Escala e diferenciaÃ§Ã£o

- API pÃºblica para integraÃ§Ãµes externas (webhooks, parceiros)
- Marketplace de plugins/integraÃ§Ãµes (contabilidade, bancos, ERPs)
- IA preditiva para investimentos e recomendaÃ§Ãµes personalizadas
- Suporte a mÃºltiplas moedas e contas internacionais
- White-label/SaaS B2B (licenciamento para consultorias/contadores)
- GamificaÃ§Ã£o (badges, conquistas, ranking de economia)
- RelatÃ³rios avanÃ§ados e dashboards customizÃ¡veis
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

# v0.9.9 - UI/UX Clean & Intuitivo (prÃ©-1.0)

### Objetivo
- Ajustar toda a interface do app para um visual mais clean, moderno e intuitivo
- Reduzir quantidade de botÃµes e elementos redundantes
- Foco em experiÃªncia fluida, onboarding simplificado e feedback visual claro
- Garantir acessibilidade e responsividade em todos os dispositivos

### ImplementaÃ§Ãµes
- RefatoraÃ§Ã£o dos principais fluxos de navegaÃ§Ã£o
- Redesign de telas e componentes para clareza e simplicidade
- Testes de usabilidade e validaÃ§Ã£o com usuÃ¡rios reais
- AtualizaÃ§Ã£o de documentaÃ§Ã£o visual e guidelines de design

---

### Features nucleares
AI CFO
Financial Autopilot
Smart Goals
Forecast
OCR receipts
Bank import

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

---

## Atualizacao 2026-03-16 (executado)

### Sprint 2 concluido
- [x] D1 Advanced Context Builder
- [x] D2 Financial Pattern Detector
- [x] D3 Financial Timeline (trend + anomaly)
- [x] D4 Financial Profile Classifier (confidence + insights)
- [x] A004 Observability (logger sink Sentry)

### Proximo bloco recomendado
- [ ] D5 Integracao de insights D3/D4 na camada de UI (dashboard e assistente)
- [ ] D6 Exposicao de metricas D3/D4 em endpoint/backend para consumo mobile
- [ ] D7 Hardening E2E Open Banking com fixture autenticada estavel (reduzir skips)

## Planejamento PrÃ³xima Sprint
- Foco em testes E2E robustos para jornadas sensÃ­veis
- Explorar integraÃ§Ã£o de notificaÃ§Ãµes push
- Avaliar expansÃ£o de relatÃ³rios e exportaÃ§Ã£o de dados
- Refinar onboarding e tutoriais in-app

## SugestÃµes TÃ©cnicas e de UX
- Melhorar feedback visual em operaÃ§Ãµes crÃ­ticas
- Adotar lazy loading em listas grandes
- Revisar acessibilidade (atalhos, foco, contraste)
- Automatizar testes E2E no CI

# v0.8.0 (mar/2026)
- Scanner: imagem/PDF âœ…
- Erro Gemini: UX aprimorada âœ…
- Open Banking: removido da UI âœ…
- Monitor de performance: ocultado âœ…
- Dashboard.tsx: refatorado âœ…

## PrÃ³ximos passos
- Testes E2E para jornadas crÃ­ticas
- Monitoramento pÃ³s-deploy de integraÃ§Ãµes

# FLOW FINANCE - ROADMAP OFICIAL

**Data:** 17 de MarÃ§o de 2026
**Status Atual:** v0.7.0 (Sprint 3 em andamento; baseline tÃ©cnico evoluÃ­do)
**Meta Estrategica:** v1.0 publico com AI Financial Assistant completo

---

## âš ï¸ DECISAO ESTRATEGICA: Open Finance (Pluggy) DESATIVADO

**Data:** 16 de Marco de 2026  
**Motivo:** Custo operacional Pluggy >R$ 1.000/mes â€” inviavel economicamente na fase prÃ©-receita  
**Status:** Infraestrutura mantida intacta com feature gate simples (`DISABLE_OPEN_FINANCE=true` no backend)  
**Reativacao:** Quando aplicacao atingir SMU (Single Monthly Unit) receita justificando custo  

**Mudancas:**
- Endpoint `/api/banking/*` retorna HTTP 503 Service Unavailable quando `DISABLE_OPEN_FINANCE=true`
- Middleware `featureGateOpenFinance` em `backend/src/middleware/featureGate.ts`
- Flag obrigatoria em `backend/.env` para reativacao; padrÃ£o = desativado
- Codigo fonte mantido para reativacao zero-effort

**Impacto:**
- âœ… Stripe Billing: Desativado tambem (pular por enquanto; manter mock billing sim)
- âœ… Core IA: Intacto (AI Context Builder, Pattern Detector, Timeline, Classifier)
- âœ… Testes: Validados pÃ³s-desativacao sem regressao
- âœ… Caminho crÃ©dito/dÃ©bito: Funciona via entrada manual + IA

---

## Visao por Fases

- `0.5.x` -> Hardening (qualidade e arquitetura)
- `0.6.x` -> InteligÃªncia financeira (concluÃ­da)
- `0.7.x` -> AutomaÃ§Ã£o financeira (Autopilot evolutivo: recomendaÃ§Ãµes ativas, overspending, metas automÃ¡ticas)
- `0.8.x` -> Integracoes financeiras
- `0.9.x` -> Preparacao SaaS
- `1.0` -> Lancamento publico

---

## v0.7.x - AutomaÃ§Ã£o financeira (em andamento)

### Objetivo
- Evoluir o Autopilot para detectar overspending em tempo real por categoria
- Gerar recomendaÃ§Ãµes ativas e sugestÃµes de corte automÃ¡ticas (com valor sugerido por categoria dominante)
- Criar metas automÃ¡ticas de corte, economia e reserva de emergÃªncia baseadas em comportamento/histÃ³rico
- Enriquecer feedback e acompanhamento de resposta do usuÃ¡rio

### ImplementaÃ§Ãµes
- Engine do Autopilot ampliada para detecÃ§Ã£o de overspending por categoria, sugestÃ£o de corte automÃ¡tico e metas automÃ¡ticas
- Testes unitÃ¡rios e cobertura crÃ­tica validados (>98%)
- DocumentaÃ§Ã£o e changelog atualizados

---

## v0.6.x - Inteligencia Financeira (fase anterior)

### Checkpoint 0.5.2v
- Protocolo de transicao formalmente iniciado e documentado
- Hardening de SaaS/services com `AppError`, validadores e repository de assinatura
- Observabilidade do orquestrador de IA estendida (call/error/latency)
- E2E Pluggy estabilizado para indisponibilidade local de backend (skip controlado)
- Lint, testes e cobertura critica aprovados no recorte protocolar
- Sprint 1 de hardening finalizada (A003-A006) com testes e build backend validados
- Sprint 2 iniciada com suÃ­te de readiness cobrindo os 6 pilares da fase 0.6.x

### Checkpoint 0.6.3
- Event-driven listeners registrados (autopilot, AI queue, forecast, audit, cache)
- Cache financeiro Map-based com TTL e invalidacao reativa por prefixo
- AI Observabilidade avancada (buffer circular, MetricsViewer, resumos por tipo)
- Log estruturado de versao no bootstrap frontend e backend
- A004 concluido: logger com sink estruturado no Sentry, redaction e fallback em console
- Lint verde, cobertura critica >= 98%
- D1 concluido: AI Context Builder avancado com score de confianca e qualidade de contexto
- D2 concluido: Pattern Detector com confianca por insight e testes de fronteira para picos/recorrencia

### Checkpoint 0.6.4
- D3 concluido: Financial Timeline Engine â€” `aggregateByMonth`, `detectBalanceTrend` (regressao linear), `detectTimelineAnomalies` (2x mediana)
- D4 concluido: Financial Profile Classifier â€” confidence, topCategories, insights acionaveis, perfil `Undefined`
- A004 lint fix: `AICFOAgent.ts` importa `FinancialProfile` centralizado
- 377/377 testes; cobertura critica 99.76%/98.3%

### Checkpoint 0.6.5 (atual)
- D5 concluido: Widget de Inteligencia Financeira no Dashboard â€” tendencia, perfil, confidence, insights, anomalias
- D6 concluido: Endpoint backend `POST /api/finance/metrics` com auth e validacao
- D7 concluido: Fixture E2E Pluggy com email fixo via env var (fix intermitencia B010-E2E)
- 387/387 testes; cobertura critica 99.76%/98.3%; lint verde

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


### 3. CategorizaÃ§Ã£o automÃ¡tica e ediÃ§Ã£o inteligente
- SugestÃ£o automÃ¡tica de categoria por IA ao editar transaÃ§Ã£o (merchant-aware)
- Modal de ediÃ§Ã£o com botÃ£o "Desfazer" para restaurar categoria anterior
- Feedback visual e acessibilidade aprimorados
- Cobertura de testes unitÃ¡rios e E2E para todo o fluxo
Exemplos:
- Uber -> transporte
- iFood -> alimentaÃ§Ã£o

### 4. Detector de assinaturas
Deteccao de servicos como:
- Netflix
- Spotify
- Amazon

**Meta de fase:** conexao robusta com dados financeiros do mundo real.

---


## v0.9.x - PreparaÃ§Ã£o SaaS

### 1. AutenticaÃ§Ã£o completa
- JWT
- refresh tokens
- OAuth

### 2. Multi-tenant e AdministraÃ§Ã£o
- Isolamento de dados por workspace/empresa
- Painel de administraÃ§Ã£o (gestÃ£o de usuÃ¡rios, planos, auditoria)
- Logs de auditoria detalhados (aÃ§Ãµes do usuÃ¡rio, alteraÃ§Ãµes sensÃ­veis)
- PolÃ­tica de retenÃ§Ã£o e exclusÃ£o de dados (LGPD/GDPR)

### 3. Plano de assinatura e billing real
- Stripe, recorrÃªncia, trial, downgrade/upgrade
- ExportaÃ§Ã£o de dados (PDF, Excel, integraÃ§Ã£o contÃ¡bil)

### 4. NotificaÃ§Ãµes e alertas
- NotificaÃ§Ãµes push/email para eventos crÃ­ticos (ex: saldo baixo, meta atingida)

### 5. Monitoramento e seguranÃ§a
- Monitoramento de performance e uptime (SLA pÃºblico)
- Plano de disaster recovery e backup automatizado
- CertificaÃ§Ã£o de seguranÃ§a (OWASP, testes de penetraÃ§Ã£o)

---

## v1.0 - LanÃ§amento PÃºblico

- Onboarding guiado e tour interativo
- FAQ e central de ajuda integrada
- IntegraÃ§Ã£o com marketplaces de apps (Google Play, App Store, Vercel, etc.)
- Canal de feedback do usuÃ¡rio e NPS

---

## PÃ³s v1.0 - Escala e diferenciaÃ§Ã£o

- API pÃºblica para integraÃ§Ãµes externas (webhooks, parceiros)
- Marketplace de plugins/integraÃ§Ãµes (contabilidade, bancos, ERPs)
- IA preditiva para investimentos e recomendaÃ§Ãµes personalizadas
- Suporte a mÃºltiplas moedas e contas internacionais
- White-label/SaaS B2B (licenciamento para consultorias/contadores)
- GamificaÃ§Ã£o (badges, conquistas, ranking de economia)
- RelatÃ³rios avanÃ§ados e dashboards customizÃ¡veis
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

# v0.9.9 - UI/UX Clean & Intuitivo (prÃ©-1.0)

### Objetivo
- Ajustar toda a interface do app para um visual mais clean, moderno e intuitivo
- Reduzir quantidade de botÃµes e elementos redundantes
- Foco em experiÃªncia fluida, onboarding simplificado e feedback visual claro
- Garantir acessibilidade e responsividade em todos os dispositivos

### ImplementaÃ§Ãµes
- RefatoraÃ§Ã£o dos principais fluxos de navegaÃ§Ã£o
- Redesign de telas e componentes para clareza e simplicidade
- Testes de usabilidade e validaÃ§Ã£o com usuÃ¡rios reais
- AtualizaÃ§Ã£o de documentaÃ§Ã£o visual e guidelines de design

---

### Features nucleares
AI CFO
Financial Autopilot
Smart Goals
Forecast
OCR receipts
Bank import

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

---

## Atualizacao 2026-03-16 (executado)

### Sprint 2 concluido
- [x] D1 Advanced Context Builder
- [x] D2 Financial Pattern Detector
- [x] D3 Financial Timeline (trend + anomaly)
- [x] D4 Financial Profile Classifier (confidence + insights)
- [x] A004 Observability (logger sink Sentry)

### Proximo bloco recomendado
- [ ] D5 Integracao de insights D3/D4 na camada de UI (dashboard e assistente)
- [ ] D6 Exposicao de metricas D3/D4 em endpoint/backend para consumo mobile
- [ ] D7 Hardening E2E Open Banking com fixture autenticada estavel (reduzir skips)


## v0.9.1 â€” Endurecimento imediato (curto prazo)
- Auth backend-first com refresh token rotativo e revogaÃ§Ã£o.
- Tenancy estrita por workspace em persistÃªncia e leitura.
- Billing readiness: webhook idempotente + reconciliaÃ§Ã£o.
- Gate de release condicionado a cobertura crÃ­tica >= 98%.
