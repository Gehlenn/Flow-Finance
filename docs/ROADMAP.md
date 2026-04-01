## Planejamento Próxima Sprint
- Foco em testes E2E robustos para jornadas sensíveis
- Explorar integração de notificações push
- Avaliar expansão de relatórios e exportação de dados
- Refinar onboarding e tutoriais in-app

## Sugestões Técnicas e de UX
- Melhorar feedback visual em operações críticas
- Adotar lazy loading em listas grandes
- Revisar acessibilidade (atalhos, foco, contraste)
- Automatizar testes E2E no CI

# v0.8.0 (mar/2026)
- Scanner: imagem/PDF ✅
- Erro Gemini: UX aprimorada ✅
- Open Banking: removido da UI ✅
- Monitor de performance: ocultado ✅
- Dashboard.tsx: refatorado ✅

## Próximos passos
- Testes E2E para jornadas críticas
- Monitoramento pós-deploy de integrações

# FLOW FINANCE - ROADMAP OFICIAL

**Data:** 17 de Março de 2026
**Status Atual:** v0.7.0 (Sprint 3 em andamento; baseline técnico evoluído)
**Meta Estrategica:** v1.0 publico com AI Financial Assistant completo

---

## ⚠️ DECISAO ESTRATEGICA: Open Finance (Pluggy) DESATIVADO

**Data:** 16 de Marco de 2026  
**Motivo:** Custo operacional Pluggy >R$ 1.000/mes — inviavel economicamente na fase pré-receita  
**Status:** Infraestrutura mantida intacta com feature gate simples (`DISABLE_OPEN_FINANCE=true` no backend)  
**Reativacao:** Quando aplicacao atingir SMU (Single Monthly Unit) receita justificando custo  

**Mudancas:**
- Endpoint `/api/banking/*` retorna HTTP 503 Service Unavailable quando `DISABLE_OPEN_FINANCE=true`
- Middleware `featureGateOpenFinance` em `backend/src/middleware/featureGate.ts`
- Flag obrigatoria em `backend/.env` para reativacao; padrão = desativado
- Codigo fonte mantido para reativacao zero-effort

**Impacto:**
- ✅ Stripe Billing: Desativado tambem (pular por enquanto; manter mock billing sim)
- ✅ Core IA: Intacto (AI Context Builder, Pattern Detector, Timeline, Classifier)
- ✅ Testes: Validados pós-desativacao sem regressao
- ✅ Caminho crédito/débito: Funciona via entrada manual + IA

---

## Visao por Fases

- `0.5.x` -> Hardening (qualidade e arquitetura)
- `0.6.x` -> Inteligência financeira (concluída)
- `0.7.x` -> Automação financeira (Autopilot evolutivo: recomendações ativas, overspending, metas automáticas)
- `0.8.x` -> Integracoes financeiras
- `0.9.x` -> Preparacao SaaS
- `1.0` -> Lancamento publico

---

## v0.7.x - Automação financeira (em andamento)

### Objetivo
- Evoluir o Autopilot para detectar overspending em tempo real por categoria
- Gerar recomendações ativas e sugestões de corte automáticas (com valor sugerido por categoria dominante)
- Criar metas automáticas de corte, economia e reserva de emergência baseadas em comportamento/histórico
- Enriquecer feedback e acompanhamento de resposta do usuário

### Implementações
- Engine do Autopilot ampliada para detecção de overspending por categoria, sugestão de corte automático e metas automáticas
- Testes unitários e cobertura crítica validados (>98%)
- Documentação e changelog atualizados

---

## v0.6.x - Inteligencia Financeira (fase anterior)

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
- A004 concluido: logger com sink estruturado no Sentry, redaction e fallback em console
- Lint verde, cobertura critica >= 98%
- D1 concluido: AI Context Builder avancado com score de confianca e qualidade de contexto
- D2 concluido: Pattern Detector com confianca por insight e testes de fronteira para picos/recorrencia

### Checkpoint 0.6.4
- D3 concluido: Financial Timeline Engine — `aggregateByMonth`, `detectBalanceTrend` (regressao linear), `detectTimelineAnomalies` (2x mediana)
- D4 concluido: Financial Profile Classifier — confidence, topCategories, insights acionaveis, perfil `Undefined`
- A004 lint fix: `AICFOAgent.ts` importa `FinancialProfile` centralizado
- 377/377 testes; cobertura critica 99.76%/98.3%

### Checkpoint 0.6.5 (atual)
- D5 concluido: Widget de Inteligencia Financeira no Dashboard — tendencia, perfil, confidence, insights, anomalias
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


### 3. Categorização automática e edição inteligente
- Sugestão automática de categoria por IA ao editar transação (merchant-aware)
- Modal de edição com botão "Desfazer" para restaurar categoria anterior
- Feedback visual e acessibilidade aprimorados
- Cobertura de testes unitários e E2E para todo o fluxo
Exemplos:
- Uber -> transporte
- iFood -> alimentação

### 4. Detector de assinaturas
Deteccao de servicos como:
- Netflix
- Spotify
- Amazon

**Meta de fase:** conexao robusta com dados financeiros do mundo real.

---


## v0.9.x - Preparação SaaS

### 1. Autenticação completa
- JWT
- refresh tokens
- OAuth

### 2. Multi-tenant e Administração
- Isolamento de dados por workspace/empresa
- Painel de administração (gestão de usuários, planos, auditoria)
- Logs de auditoria detalhados (ações do usuário, alterações sensíveis)
- Política de retenção e exclusão de dados (LGPD/GDPR)

### 3. Plano de assinatura e billing real
- Stripe, recorrência, trial, downgrade/upgrade
- Exportação de dados (PDF, Excel, integração contábil)

### 4. Notificações e alertas
- Notificações push/email para eventos críticos (ex: saldo baixo, meta atingida)

### 5. Monitoramento e segurança
- Monitoramento de performance e uptime (SLA público)
- Plano de disaster recovery e backup automatizado
- Certificação de segurança (OWASP, testes de penetração)

---

## v1.0 - Lançamento Público

- Onboarding guiado e tour interativo
- FAQ e central de ajuda integrada
- Integração com marketplaces de apps (Google Play, App Store, Vercel, etc.)
- Canal de feedback do usuário e NPS

---

## Pós v1.0 - Escala e diferenciação

- API pública para integrações externas (webhooks, parceiros)
- Marketplace de plugins/integrações (contabilidade, bancos, ERPs)
- IA preditiva para investimentos e recomendações personalizadas
- Suporte a múltiplas moedas e contas internacionais
- White-label/SaaS B2B (licenciamento para consultorias/contadores)
- Gamificação (badges, conquistas, ranking de economia)
- Relatórios avançados e dashboards customizáveis
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

# v0.9.9 - UI/UX Clean & Intuitivo (pré-1.0)

### Objetivo
- Ajustar toda a interface do app para um visual mais clean, moderno e intuitivo
- Reduzir quantidade de botões e elementos redundantes
- Foco em experiência fluida, onboarding simplificado e feedback visual claro
- Garantir acessibilidade e responsividade em todos os dispositivos

### Implementações
- Refatoração dos principais fluxos de navegação
- Redesign de telas e componentes para clareza e simplicidade
- Testes de usabilidade e validação com usuários reais
- Atualização de documentação visual e guidelines de design

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
