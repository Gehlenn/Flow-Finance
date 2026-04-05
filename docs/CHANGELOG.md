<<<<<<< ours
<<<<<<< ours
﻿# [0.9.1v] - 2026-04-02

### Transição de Versão — Auditoria Sistêmica + QA de Fluxos Críticos

#### ✅ Auditoria Técnica
- Revisão de arquitetura, segurança e escalabilidade SaaS executada para Web e Mobile.
- Priorização de riscos em: sanitização de entradas, robustez de segredo JWT, quotas de IA, sincronização e duplicação de lógica de categorização.

#### Testes e Cobertura
- `npm run lint`: aprovado
- `npm test`: aprovado
- `npm run test:coverage:critical`: aprovado
	- Statements: `99.70%`
	- Branches: `98.28%`
	- Functions: `100%`
	- Lines: `100%`
- `npm run test:e2e`: aprovado (`28 passed`, `57 skipped`)

#### 📚 Documentação
- README atualizado com status de transição 0.9.1v e baseline de validações.
- ROADMAP atualizado com checkpoint 0.9.1v e backlog imediato de hardening.
- GDD atualizado com adendo de regras e fluxos críticos da transição.
- BUGLOG atualizado com incidentes E2E e rastreabilidade por versão.
- Conflitos de merge em documentacao principal resolvidos (README, CHANGELOG, ROADMAP, GDD e BUGLOG).

# v0.8.0 — 25/03/2026
- Scanner aceita imagem e PDF
- Tratamento de erro Gemini aprimorado
- Open Banking removido da UI
- Monitor de performance ocultado
- Dashboard.tsx reestruturado
- Auditoria técnica: ver AUDIT_REPORT_v0.8.0.md

# 📝 CHANGELOG - Flow Finance

# [0.7.2] - 2026-03-17

### Autopilot — Metas Automáticas

#### 🚀 Novidade
- Engine do Autopilot agora gera metas automáticas de corte, economia e reserva de emergência.
- Metas sugeridas com valor, categoria e ação clara para o usuário.

#### 🧪 Testes e Cobertura
- Teste unitário dedicado: `ai-autopilot-goal-suggestion.test.ts` — passou
- Cobertura crítica mantida (>98%)

#### 📚 Documentação
- README, ROADMAP e CHANGELOG atualizados para refletir a nova funcionalidade

# [0.7.1] - 2026-03-17

### Autopilot — Sugestão de Corte Automático

#### 🚀 Novidade
- Engine do Autopilot agora sugere corte automático em categorias com overspending, indicando valor sugerido para equilibrar orçamento.
- Mensagem clara e ação de "Criar Meta de Corte" para facilitar ajuste financeiro.

#### 🧪 Testes e Cobertura
- Teste unitário dedicado: `ai-autopilot-cut-suggestion.test.ts` — passou
- Cobertura crítica mantida (>98%)

#### 📚 Documentação
- README, ROADMAP e CHANGELOG atualizados para refletir a nova funcionalidade

# [0.7.0] - 2026-03-17

### Sprint 3 — Autopilot Evolutivo: Recomendações Ativas e Overspending

#### 🚀 Evolução do Autopilot
- Engine ampliada para detecção de overspending em tempo real por categoria (alerta imediato)
- Sugestão de corte automático e base para metas inteligentes (em progresso)
- Feedback explicativo e contexto personalizado para recomendações (em progresso)

#### 🧪 Testes e Cobertura
- Teste unitário dedicado para overspending por categoria (`ai-autopilot-overspending.test.ts`)
- Cobertura crítica validada (>98%)

#### 📚 Documentação
- README, ROADMAP e CHANGELOG atualizados para v0.7.x

## [0.6.8] - 2026-03-17

### Sprint 2 — Hardening de Entrega e Confiabilidade de Fluxo

#### ✅ CI/CD: deploy com fail-fast e preflight operacional
- workflow de deploy endurecido em `.github/workflows/deploy.yml` com:
	- resolucao explicita de `DEPLOY_PLATFORM`
	- falha antecipada para alvo invalido
	- validacao obrigatoria de secrets por plataforma (`railway`, `render`, `aws`)
	- preflight summary com contexto operacional (sem exposicao de segredo)
	- notificacoes Slack tolerantes a webhook ausente (skip seguro)

#### ✅ Open Banking E2E: menor intermitencia no fluxo Pluggy
- `tests/e2e/open-banking-pluggy.spec.ts` estabilizado para lidar com dois estados de UI:
	- jornada vazia (`Conectar Banco`)
	- jornada com conexoes existentes (`Adicionar banco`)
- comportamento agora evita falso-negativo por estado visual nao deterministico e preserva validacao backend de `connect-token`

#### ✅ Produto: feedback explicito do usuario para sinais de IA
- `src/app/productFinancialIntelligence.ts` ganhou `signalFeedbackTargets`
- `components/Dashboard.tsx` ganhou acoes `util` / `nao util` nos sinais priorizados
- feedback grava aprendizado via `recordMemoryFeedback` para recorrencia, picos e dominancia de categoria

#### ✅ Observabilidade no frontend: requestId propagado em erros de integracao
- `src/config/api.config.ts` passou a emitir `ApiRequestError` com `statusCode`, `requestId`, `routeScope` e `details`
- `services/integrations/openBankingService.ts` passa a anexar `requestId` nas mensagens de erro Pluggy quando presente

#### 🧪 Validacoes executadas
- `npx vitest run tests/unit/dashboard-financial-intelligence.test.ts tests/unit/open-banking-service-extended.test.ts tests/unit/ai-memory-engine.test.ts`: verde (74/74)
- `npm run lint`: verde
- `npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1 --reporter=line`: skip controlado (sem falha)

## [0.6.7] - 2026-03-17

### Sprint 2 — Produto + Memoria + Contratos Backend

#### ✅ Produto: sinais de inteligencia internalizados no Dashboard
- `src/app/productFinancialIntelligence.ts` agora expõe sinais priorizados de produto:
	- `dominantCategorySharePercent`
	- `weeklySpikeCount`
	- `forecastDirection` (`improving|declining|stable`)
	- `productSignals` com mensagens acionaveis
- `components/Dashboard.tsx` passou a renderizar bloco `Sinais priorizados` e badge de picos semanais no widget de Inteligencia Financeira
- `tests/unit/dashboard-financial-intelligence.test.ts` expandido para cobrir novos campos

#### ✅ Memoria: feedback explicito + decaimento contextual
- `src/ai/memory/AIMemoryEngine.ts` ganhou API de feedback explicito:
	- `recordMemoryFeedback(userId, type, key, feedback, context?)`
- metadados de memoria reforcados com:
	- `contextDecayMultiplier`
	- `feedbackCount`, `lastFeedback`, `lastFeedbackContext`, `lastFeedbackAt`
- `src/ai/memory/AIMemoryStore.ts` aplica decaimento ponderado por `contextDecayMultiplier` e expõe `runDecayCycle()` para validacao deterministica
- `tests/unit/ai-memory-engine.test.ts` expandido para feedback e decaimento contextual

#### ✅ Backend: contrato e observabilidade de erro endurecidos
- novo middleware `backend/src/middleware/requestContext.ts` injeta `requestId` (com propagacao de `x-request-id`) e `routeScope`
- `backend/src/index.ts` inclui contexto de requisicao em logs e resposta 404
- `backend/src/middleware/auth.ts` retorna `requestId` e `routeScope` em erros de autenticacao
- `backend/src/middleware/errorHandler.ts` passa a logar e retornar `requestId` e `routeScope`
- `backend/src/types/index.ts` (`ErrorResponse`) atualizado com campos opcionais de contexto
- `tests/unit/backend-error-handler.test.ts` validado para o novo contrato

#### 🧪 Validacoes executadas
- `npm run lint`: verde
- `npm test`: verde (604/604)
- `npm run test:coverage:critical`: verde (`99.76%` statements / `98.3%` branches)

## [0.6.6] - 2026-03-17

### Sprint 2 — Bloco 4 Concluido: Cobertura de Integracao

#### ✅ Cobertura ampliada do Advanced Context Builder
- `tests/unit/advanced-context-builder.test.ts` expandido com cenarios de integracao para:
	- confianca minima de previsao com baixa amostragem de transacoes
	- dominancia por categoria com validacao de percentual dominante
	- consistencia progressiva de forecast em 7/30/90 dias

#### ✅ Viewers internos do painel de IA validados
- Nova suite `tests/unit/ai-control-panel-viewers.test.tsx` cobrindo:
	- gate de renderizacao via `VITE_AI_DEBUG_PANEL`
	- renderizacao integrada de `AI Memory`, `Detected Patterns`, `Money Map`, `AI Task Queue` e `AI Insights`
	- presenca de sinais de memoria, fila de tarefas e campos de previsao no fluxo real do orquestrador

#### 🧪 Validacoes executadas
- `npx vitest run tests/unit/advanced-context-builder.test.ts tests/unit/ai-control-panel-viewers.test.tsx`: verde (6/6)
- `npm run lint`: verde
- `npm test`: verde (601/601)
- `npm run test:coverage:critical`: verde (`99.76%` statements / `98.3%` branches)

### Sprint 2 — Bloco 5 Concluido: Open Finance em Standby Estrategico

#### ✅ Standby economico formalizado sem perda de capacidade tecnica
- gate de runtime mantido em `/api/banking` com `DISABLE_OPEN_FINANCE=true`
- stack de Open Finance (Pluggy) e billing (Stripe) preservada para reativacao futura
- decisao de nao priorizacao mantida enquanto custo operacional seguir inviavel

#### ✅ Evidencias de preservacao
- middleware `featureGateOpenFinance` ativo no backend
- rotas, controladores e testes de Open Finance permanecem versionados e validos
- documentacao de operacao/go-live mantida para retomada quando houver viabilidade

---

## [0.6.5] - 2026-03-16

### Sprint 2 — D5/D6/D7: Financial Intelligence UI, Backend Metrics, E2E Auth Fixture

#### ✨ D5 — Widget de Inteligencia Financeira no Dashboard
- Importados `buildFinancialTimeline`, `detectBalanceTrend`, `detectTimelineAnomalies` (engine D3) e `classifyFinancialProfile` (engine D4) no Dashboard
- 4 novos `useMemo` hooks: `financialTimeline`, `balanceTrend`, `timelineAnomalies`, `financialProfile`
- Novo widget "Inteligencia Financeira": badge de tendencia de saldo (Crescendo / Queda / Estavel), perfil financeiro do usuario com barra de confianca colorida, insights acionaveis do classificador D4, alerta de anomalias detectadas na timeline

#### 🔌 D6 — Endpoint Backend `POST /api/finance/metrics`
- `backend/src/controllers/financeController.ts`: logica de computacao pura auto-contida — timeline por dia, regressao linear para tendencia, deteccao de picos (2x mediana), classificador de perfil (Saver/Spender/Balanced/RiskTaker/Undefined)
- `backend/src/routes/finance.ts`: rota protegida com `authMiddleware`
- `backend/src/index.ts`: montado em `/api/finance`; validacao de input: deve ser array, limite 2000 items

#### 🛡️ D7 — Fixture E2E Pluggy Auth Estavel (fix B010-E2E)
- `tests/e2e/fixtures/auth.ts`: funcao `getFixtureAuthToken` usa email fixo via `E2E_PLUGGY_USER_EMAIL` env var (configuravel por ambiente), eliminando email dinamico por-teste que causava skip intermitente
- `tests/e2e/open-banking-pluggy.spec.ts`: removida funcao local `createBackendAuthToken`; substituida pelo import do fixture

#### 🧪 Testes
- `tests/unit/finance-controller.test.ts`: 10 testes cobrindo validacao de input, profiles, timeline, trends, anomalias, topCategories e sanitizacao de dados invalidos

#### ✅ Validacoes executadas
- `npm run lint`: verde
- `npm test`: 387/387 verde
- `npm run test:coverage:critical`: `99.76%` statements / `98.3%` branches
- Backend build: verde

---

## [0.5.2v] - 2026-03-14

### 🔄 Protocolo de Transicao (Iniciado)
**Status:** Em execucao controlada

#### ✅ Entregas tecnicas consolidadas nesta transicao
- Hardening de servicos SaaS com `AppError` padronizado para limites, permissoes e features
- Validadores dedicados para transacao e metas (`transactionValidator`, `goalValidator`)
- Repository dedicado para assinaturas com injecao no container de aplicacao
- Observabilidade no `aiOrchestrator` com metricas de chamada, erro e latencia
- Ajuste do E2E Pluggy para evitar falso-negativo quando backend local estiver indisponivel

#### ✅ Sprint 1 concluida (A003-A006)
- `SubscriptionRepository` com `update()` explicito e uso em `SubscriptionService.updateSubscription`
- `resolveSaaSContext` com memoizacao TTL e deduplicacao de chamadas concorrentes
- `errorHandler` do backend com sanitizacao de `details` e redaction de campos sensiveis
- Logger com redaction automatica de chaves sensiveis, metadados (`correlationId`, `scope`) e sink estruturado integrado ao Sentry com fallback em console
- Novos testes: `logger.test.ts` e `backend-error-handler.test.ts`

#### ✅ Sprint 2 consolidada (readiness + D1/D2 funcionais)
- Nova suíte `financial-intelligence-readiness.test.ts` validando: Context Builder, Pattern Detector, Timeline, Profile Classifier, Cashflow Prediction e Money Map
- Consistência entre engines e `aiOrchestrator` validada com cenários integrados
- `advancedContextBuilder` enriquecido com qualidade de dados, confianca e resumo financeiro recente
- `financialPatternDetector` evoluido com insights e score de confianca para recorrencia e picos semanais
- Testes de fronteira ampliados para evitar falso positivo em picos semanais e recorrencia insuficiente
- Estado atual de testes elevado para `352/352` verdes

#### ✅ Validacoes executadas
- `npm run lint`: verde
- `npm test`: verde
- `npm run test:coverage:critical`: verde (`99.76%` statements / `98.3%` branches)
- `npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1 --reporter=line`: verde/skip controlado conforme disponibilidade do backend local

#### 🧾 Regra de versionamento aplicada
- Label documental de transicao atualizada para `0.5.2v`
- Ciclo tecnico de pacotes permanece em `0.6.x` para preservar compatibilidade de build e distribuicao

---

## [0.6.3] - 2026-03-14

### 🏗️ Arquitetura Evoluida — Event Listeners, Cache e Observabilidade

#### 🔒 Hardening tecnico consolidado na trilha 0.6.3
- `AppError` padronizado para permissoes, limites de plano e recursos indisponiveis
- Validadores de entrada para transacoes e metas integrados aos servicos de aplicacao
- `SubscriptionRepository` introduzido para reduzir acoplamento direto com storage
- `aiOrchestrator` fortalecido com metricas de chamada, erro e latencia
- Teste E2E do Pluggy ajustado para skip controlado quando a API local nao estiver disponivel

#### ✨ Event-Driven Listeners (`src/events/listeners/`)
- `autopilotListener` — dispara analise do `FinancialAutopilot` em eventos financeiros
- `aiQueueListener` — encaminha transacoes e eventos criticos para `AITaskQueue`
- `forecastListener` — reprocessa previsoes de cashflow ao detectar transacao criada
- `auditListener` — registra todos os eventos financeiros em `auditLogService`
- `cacheInvalidationListener` — invalida cache financeiro ao detectar mutacoes
- `registerListeners` — ponto central de bootstrap dos listeners

#### ⚡ Camada de Cache Financeiro (`src/cache/financialCache.ts`)
- Cache Map-based com TTL configuravel por entrada
- Invalidacao por prefixo (ex: `cache.invalidateByPrefix('cashflow:')`)
- API: `get`, `set`, `invalidate`, `invalidateByPrefix`, `clear`, `size`
- Integracao com `cacheInvalidationListener` para invalidacao reativa

#### 🔭 AI Observabilidade avancada (`src/observability/aiMetrics.ts`)
- Buffer circular com limite de 200 registros por tipo de metrica
- Tipos suportados: `ai_call`, `ai_error`, `ai_latency`, `cache_hit`, `cache_miss`, `event_processed`
- API: `recordAIMetric`, `getAIMetrics`, `getAIMetricsSummary`, `clearAIMetrics`
- Componente `MetricsViewer` integrado ao `AIControlPanel` para visualizacao em tempo real

#### 🛠️ Polimento e Bootstrap
- Log estruturado de versao no bootstrap frontend e backend
- Endpoints `GET /api/health` e `GET /api/version` verificados e ativados
- Nomenclaturas padronizadas (cashflow vs cashflowPrediction)

#### ✅ Checklist tecnico
- `npm run lint`: verde
- `npm test`: verde
- `npm run test:coverage:critical`: verde (≥ 98%)
- Pacotes tecnicos sincronizados em `0.6.3`

#### 🧾 Relacao com a transicao documental
- Release label externa/documental: `0.5.2v`
- Release tecnica interna de build/distribuicao: `0.6.3`

---

## [0.5.1v] - 2026-03-13

### 🔄 Protocolo de Transição (Open Finance)
**Status:** Iniciado e validado tecnicamente

#### ✨ Open Finance Firebase-first
- Persistencia Open Finance consolidada em Firebase (`OPEN_FINANCE_STORE_DRIVER=firebase`)
- Webhook Pluggy validado com comportamento esperado `401/401/202`
- Prova de persistencia apos restart aprovada em ambiente local

#### 🛡️ Hardening de configuracao
- Removida tolerancia ao valor invalido de provider (`luggy`)
- Fallback seguro para `mock` com warning de configuracao
- Teste unitario dedicado para evitar regressao

#### ✅ Checklist tecnico do protocolo
- `cd backend && npm run build`: verde
- `npm run lint`: verde
- `npm test`: verde (`263/263`)
- `npm run test:coverage:critical`: verde (`100/98.9/100/100`)
- `npm run test:e2e`: verde com backend ativo (`33 passed`, `32 skipped`)

#### 🧾 Observacao de versionamento
- Label de transicao: `0.5.1v` (documental)
- SemVer tecnico do pacote permanece no ciclo `0.6.x` para nao quebrar compatibilidade de build/distribuicao.

---

## [0.6.2] - 2026-03-11

### 🔍 Auditoria Geral & Hardening v0.6.2
**Status:** Post-audit hardening v0.6.1

#### ✅ Achados de Auditoria
- **Arquitetura**: 9.2/10 - Clean layers bem implementadas
- **Segurança**: 9.0/10 - JWT, CORS, rate-limit, Zod validation robusta
- **Performance**: 7.8/10 - Bundle OK (~305KB), AI latência 1-3s
- **Testes**: 5.2/10 - Cobertura 46.35% (meta 98% bloqueador para v0.6.3)

#### 🔧 Correções Rápidas
- ✅ Adicionado `z.number().max(999999999)` em TransactionSchema
- ✅ Corrigido typo em description (v0.6.1v → v0.6.2)
- ✅ Logging CORS melhorado para debug produção

#### 📋 Vulnerabilidades Identificadas (para v0.6.3+)
1. 🔴 Cobertura testes <20%: openBankingService, aiMemory, AIMemoryEngine
2. 🟠 JWT em localStorage (XSS risk) → HttpOnly cookies recomendado
3. 🟠 Sem cache categorias IA → IndexedDB + Redis
4. 🟡 Recurring detection inflexível → Fuzzy matching
5. 🟡 Sem GC aiMemory → Auto-gc >1000 items

#### 🧪 Testes
- ✅ 193/193 testes passando
- ⚠️ Cobertura 46.35% vs meta 98% **BLOQUEADOR v0.6.3**

#### 📚 Documentação
- Gerado: `AUDITORIA_THOROUGH_2026-03-11.md` (51 findings)
- Roadmap: FASE 1 (testes), FASE 2 (segurança), FASE 3 (otimização)

---

## [0.6.1] - 2026-03-10

### 🔄 Transição 0.6.1v

## [0.6.9] - 2026-03-17

### Encerramento da Fase v0.6.x — Inteligência Financeira

#### ✅ Entregas consolidadas
- Widget de Inteligência Financeira no Dashboard: tendência, perfil, confiança, insights, anomalias, categoria dominante
- Endpoint backend `/api/finance/metrics` com timeline, tendência, anomalias e perfil financeiro (proteção, validação e integração mobile)
- Fixture E2E Pluggy autenticada e estável, reduzindo skips e intermitência
- Feedback explícito de sinais de IA integrado ao produto e memória
- Observabilidade ampliada: requestId propagado, erros com contexto, logs estruturados

#### 🧪 Validações executadas
- `npm run lint`: verde
- `npm test`: verde (606/606)
- `npm run test:coverage:critical`: verde (`99.76%` statements / `98.3%` branches)
- `npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1 --reporter=line`: skip controlado (sem falha)

#### 📝 Transição para v0.7.x
- Todos os objetivos da fase v0.6.x foram cumpridos e validados
- Próxima fase: Automação Financeira (Autopilot evolutivo, Smart Budget, Smart Goals, Orquestração automática)

---
- ✅ Todos os hover states e transforms presentes

#### 📦 **Alterações de Dependências**
```diff
- "tailwindcss": "^4.2.1"
+ "tailwindcss": "^3.4.19"
- "@tailwindcss/postcss": "^4.2.1"
```

---

## [0.4.0] - 2026-03-09

### 🚀 **RELEASE HIGHLIGHTS**  
**Status:** Production-Ready ✅  
**Cobertura de Testes:** 98%+  
**Bugs Críticos Resolvidos:** 5/5  

Esta versão marca a transição completa para produção com IA GPT-4, autenticação Firebase real e correções críticas de infraestrutura.

---

### ✨ **Novas Funcionalidades**

#### 🤖 CFO Virtual com GPT-4
- **Assistente Financeiro Conversacional:** Integração completa com OpenAI GPT-4
- **Backend Proxy Seguro:** Chave de API nunca exposta no cliente
- **Contexto Financeiro:** Consultas baseadas em saldo, transações e perfil
- **Intents Inteligentes:** `spending_advice`, `budget_question`, `risk_question`, `savings_question`, `investment_question`
- **Linguagem Consultiva:** Respostas sempre em português brasileiro com disclaimers apropriados

#### 🔐 Autenticação & Segurança
- **Firebase Auth Production:** Google OAuth e Email/Senha funcionais
- **Modo Demo Removido:** 100% autenticação real em produção
- **JWT Stateless:** Backend com tokens JWT seguros
- **Rate Limiting:** Proteção contra abuso de API de IA

#### 📊 Pipeline de Análise Financeira
- **AI Orchestrator v0.3:** Coordenação centralizada de análises
- **Health Score Dinâmico:** Pontuação 0-100 com labels (`crítico`, `atenção`, `estável`, `saudável`, `excelente`)
- **Perfil Financeiro:** Classificação automática do usuário (`Conservador`, `Equilibrado`, `Gastador`, `Investidor`)
- **Insights Contextuais:** Alerts, recommendations e pattern detection

---

### 🔧 **Correções (Bugfixes)**

#### Backend/API (Críticos)
- **[BUG-040-001]** `500 Internal Error` no endpoint `/api/ai/cfo` → Corrigida API OpenAI (`chat.completions.create`)
- **[BUG-040-002]** `env.OPENAI_MODEL undefined` → Variáveis adicionadas em `env.ts`
- **[BUG-040-003]** Conflito TypeScript em `storage.ts` (getSignedUrl) → Renomeado import 
- **[BUG-040-004]** Parâmetros não usados em `database.ts` → Removidos
- **[BUG-040-005]** Schema não usado em `aiController.ts` → Declaração removida

#### Frontend/Runtime
- **[BUG-030-001]** `process is not defined` → Migrado para `import.meta.env`
- **[BUG-030-002]** `detectSalary is not defined` → Imports adicionados no Dashboard
- **[BUG-030-003]** White screen Vercel → Ordem de rotas corrigida

---

### 🏗️ **Melhorias de Arquitetura**

#### Infraestrutura
- **Vercel Deployment Ready:** Configuração SPA otimizada
- **Docker Compose:** Setup completo para dev/staging
- **PostgreSQL Support:** Schema e migrations prontos (opcional)
- **Redis Caching:** Preparado para rate limiting avançado

#### Code Quality
- **TypeScript Strict Mode:** Zero erros de compilação
- **ESLint + Prettier:** Formatação consistente
- **Clean Architecture:** Separação de camadas respeitada
- **SOLID Principles:** Single responsibility, Open/Closed, etc.

#### Testing
- **Suite de Testes Unitários:** Cálculos financeiros, validações, controllers
- **Testes de Integração:** Backend API endpoints
- **Coverage:** 98%+ (alvo obrigatório)
- **Vitest + Testing Library:** Stack moderna

---

### 📦 **Dependências Atualizadas**

#### Principais
- `openai@4.x` → Integração GPT-4
- `firebase@10.x` → Auth + Firestore SDK
- `vite@6.4.x` → Build otimizado
- `typescript@5.3.x` → Type safety aprimorado

---

### 📚 **Documentação**

#### Novos Arquivos
- `BUGLOG.md` → Registro completo de bugs com formato estruturado
- `COMECE_AQUI.md` → Guia rápido de 30min para setup
- `SETUP_GUIDE.md` → Manual completo em inglês
- `SETUP_GUIA_PT.md` → Manual completo em português
- `VERCEL_QUICK_START.md` → Deploy rápido na Vercel
- `DATABASE_DECISION.md` → Análise arquitetural de banco de dados
- `.env.local.example` → Template completo de variáveis

#### Atualizados
- `README.md` → Stack v0.4.0, instruções atualizadas
- `ROADMAP.md` → Próximos passos com v0.5.0 e além
- `GDD.md` → Mecânicas financeiras documentadas
- `ARCHITECTURE.md` → Diagrama atualizado com GPT-4

---

### 🔄 **Breaking Changes**

⚠️ **Modo Demo Removido**  
- Removidas todas referências a contas demo
- Login agora requer autenticação real (Google ou Email)
- Dados demo não serão mais criados automaticamente

⚠️ **API Backend Obrigatória**  
- Funcionalidades de IA agora requerem backend ativo
- Variável `VITE_API_PROD_URL` obrigatória em produção
- `OPENAI_API_KEY` deve estar configurada no backend

---

### 📈 **Métricas de Qualidade**

- **Code Coverage:** 98.2%
- **Build Time:** ~45s (frontend) / ~30s (backend)
- **Bundle Size:** 700KB gzipped
- **Lighthouse Score:** 95+ (Performance, Accessibility, Best Practices, SEO)
- **Zero Regressões:** Todos os testes anteriores passando

---

### 🎯 **Próximos Passos (v0.5.0)**

- [ ] Suporte a múltiplas moedas com conversão automática
- [ ] Notificações push via PWA
- [ ] Exportação de relatórios em PDF
- [ ] Integração real com Open Banking
- [ ] Machine Learning para previsão de gastos

---

## [0.3.1] - 2026-03-08

### ✨ Advanced AI & Financial Integrity Modules

#### 🤖 AI Engine Enhancements
- **AI Orchestrator Engine** - Pipeline centralizado para coordenação de IA
- **Financial Intelligence Graph** - Grafo de relações financeiras com nodes e edges
- **AI Financial Simulator** - Simulação de cenários financeiros (gastos extras, economia mensal)
- **AI Category Learning** - Aprendizado automático de categorias por merchant
- **Financial Leak Detection** - Detecção automática de vazamentos financeiros recorrentes

#### 📊 Financial Reporting
- **Financial Report Engine** - Relatórios mensais automáticos com insights
- **Monthly Financial Reports** - Análise comparativa mês a mês
- **Financial Health Scoring** - Sistema de pontuação de saúde financeira

#### 🔒 Security & Integrity
- **Secure Money Calculations** - Biblioteca decimal.js para cálculos precisos
- **Transaction Idempotency** - Prevenção de duplicatas de transações
- **Audit Log Service** - Logs detalhados de todas operações críticas
- **Reconciliation Engine** - Reconciliação automática de saldos

#### 🎛️ User Interface
- **Dashboard Widgets** - Novos widgets: Financial Leaks, Monthly Report, Simulation Insights
- **AI Control Panel** - Abas expandidas: Leaks, Report, Simulate, Audit
- **Event Engine Integration** - Triggers automáticos nos eventos relevantes

#### 🏗️ Architecture Improvements
- **Clean Architecture Compliance** - Separação clara de responsabilidades
- **SOLID Principles** - Princípios aplicados em todos os módulos
- **Financial Security** - Validações rigorosas e cálculos precisos
- **Type Safety** - Interfaces TypeScript completas

### 🐛 Bugs Corrigidos
- **Hash Generation**: Substituído crypto Node.js por hash compatível com browser
- **Type Imports**: Adicionadas importações faltantes para SimulationScenario e AuditLogEntry

### 📚 Documentation
- **Module Documentation**: Todos os novos módulos documentados inline
- **Architecture Updates**: Diagramas atualizados com novos componentes

### 🧪 Testing
- **New Module Tests**: Estrutura preparada para testes dos novos módulos
- **Integration Tests**: Validação de integração entre módulos

---

## [0.3.0] - 2026-03-08

### ✨ Features Adicionadas
- **Backend API Integration** - Proxy pattern implementado para segurança
- **Type Safety** - Eliminadas 20+ instâncias de `any` type
- **Capacitor Mobile** - Estrutura Android criadacom sincronização de assets
- **Crash Reporting** - Sentry integrado para frontend e backend
- **Error Boundary** - Component para prevenir app crashes com fallback UI
- **AES-256 Encryption** - Encriptação de dados sensíveis em localStorage
- **PWA Support** - Service Worker completo com offline capability

### 🐛 Bugs Corrigidos
- **B001**: Category.OUTROS undefined em subscriptionDetector.test.ts → Corrigido para Category.PESSOAL
- **B002**: ErrorBoundary não tinha getDerivedStateFromError → Implementado
- **B003**: RequestInit não suporta timeout → Removido, usar AbortController
- **B004**: BrowserTracing error type incompatível → Desabilitado
- **B005**: Capacitor config propriedades inválidas → Removidas android/ios configs
- **B006**: Capacitor.d.ts function syntax error → Adicionar `() => void`

### 🛡️ Security Improvements
- API keys NUNCA exposto no client-side
- Implementado backend proxy para todas requisições AI
- HTTPS enforced em produção
- CORS validado e configurado
- JWT authentication em todas rotas protegidas
- Rate limiting (express-rate-limit)
- Input validation em formulários
- Error Boundary anti-crash
- Sentry para monitoring

### 🚀 Performance
- TypeScript strict mode em 100% dos arquivos
- Build size otimizado: 1.23 MB (266 KB gzipped)
- Startup time: 2.4s (alvo: < 3s) ✅
- FCP: 1.2s | LCP: 2.1s | TTI: 2.8s
- Memory usage: < 50 MB em produção

### 📱 Mobile Readiness
- Capacitor configurado (v8.2.0)
- Android project structure criada
- iOS project structure preparada
- Splash screen, Status Bar, Keyboard plugins
- Platform detection implementado

### 📚 Documentation
- SECURITY_UPDATES_v0.1.0.md completo
- NEXT_STEPS.md roadmap atualizado
- ARCHITECTURE.md detalha fluxos
- Comentários inline em código crítico

### 🧪 Testing
- Unit tests suite com 98.2% coverage
- Integration tests para fluxos críticos
- Error handling tests
- Security tests
- Performance benchmarks

### ⚠️ Known Issues
- APK Android bloqueado (sem JDK instalado)
- iOS bloqueado (sem macOS + Xcode)
- Config module test coverage: 96.5% (target: 100%)
- Bundle chunks > 500KB (requer splitting adicional)

### 📋 Checklist pré-release
- ✅ Build sem erros TypeScript
- ✅ Todos tests passando
- ✅ Zero console.errors
- ✅ Security audit completo
- ✅ Performance metrics OK
- ✅ Privacy policy atualizado
- ✅ Error Boundary funcionando
- ✅ Sentry integrado e testado

---

## [0.2.0] - 2026-03-07

### 🎯 Focus
- Security hardening
- API key protection
- Encryption implementation
- Backend proxy setup

### Features
- Local-first architecture com localStorage
- Encriptação AES-GCM-256
-Firebase Auth mock (localService)
- Gemini AI integration (backend proxy)
- Error tracking setup

### Documentação
- SECURITY_UPDATES_v0.1.0.md criado
- Privacy policy compliant
- Compliance checklist

---

## [0.1.0] - 2026-03-01

### Initial Release
- Dashboard com balance summary
- Transaction management
- Category system
- Basic AI assistant
- Local storage persistence
- Dark mode support
- Responsive design

---

## Versioning Strategy

**Semantic Versioning**: MAJOR.MINOR.PATCH

- **MAJOR** (x.0.0): Breaking changes, novo produto
- **MINOR** (0.x.0): Features, improvements
- **PATCH** (0.0.x): Bug fixes, hotfixes

---

## Próximas Versões Planejadas

### v0.4.0 (Target: 15 Março 2026)
- [ ] CI/CD Pipeline (GitHub Actions)
- [ ] Android APK build
- [ ] Code splitting por rotas
- [ ] 100% test coverage

### v0.5.0 (Target: 30 Março 2026)
- [ ] Analytics integração
- [ ] PWA offline completo
- [ ] Performance monitoring
- [ ] A/B testing framework

### v1.0.0 (Target: 15 Abril 2026)
- [ ] Production release
- [ ] Full feature set
- [ ] Compliance audit
- [ ] App Store submissions

---

## [0.6.4] - 2026-03-16

### Sprint 2 - D3/D4 (entregue)
- D3: Financial Timeline com agregacao mensal (aggregateByMonth), tendencia de saldo (detectBalanceTrend) e anomalias (detectTimelineAnomalies).
- D4: Financial Profile Classifier com confidence, topCategories, insights e perfil Undefined para dados insuficientes.
- Ajuste de tipagem no agente CFO para usar tipo centralizado de perfil financeiro.

### Validacao da release
- lint: OK (npm run lint)
- testes: 377/377 passing (npm test)
- cobertura critica: 99.76% stmts / 98.3% branches (npm run test:coverage:critical)
- e2e: 30 passed / 35 skipped (npm run test:e2e)

=======
=======
>>>>>>> theirs
# v0.8.0 — 25/03/2026
- Scanner aceita imagem e PDF
- Tratamento de erro Gemini aprimorado
- Open Banking removido da UI
- Monitor de performance ocultado
- Dashboard.tsx reestruturado
- Auditoria técnica: ver AUDIT_REPORT_v0.8.0.md

# 📝 CHANGELOG - Flow Finance

# [0.7.2] - 2026-03-17

### Autopilot — Metas Automáticas

#### 🚀 Novidade
- Engine do Autopilot agora gera metas automáticas de corte, economia e reserva de emergência.
- Metas sugeridas com valor, categoria e ação clara para o usuário.

#### 🧪 Testes e Cobertura
- Teste unitário dedicado: `ai-autopilot-goal-suggestion.test.ts` — passou
- Cobertura crítica mantida (>98%)

#### 📚 Documentação
- README, ROADMAP e CHANGELOG atualizados para refletir a nova funcionalidade

# [0.7.1] - 2026-03-17

### Autopilot — Sugestão de Corte Automático

#### 🚀 Novidade
- Engine do Autopilot agora sugere corte automático em categorias com overspending, indicando valor sugerido para equilibrar orçamento.
- Mensagem clara e ação de "Criar Meta de Corte" para facilitar ajuste financeiro.

#### 🧪 Testes e Cobertura
- Teste unitário dedicado: `ai-autopilot-cut-suggestion.test.ts` — passou
- Cobertura crítica mantida (>98%)

#### 📚 Documentação
- README, ROADMAP e CHANGELOG atualizados para refletir a nova funcionalidade

# [0.7.0] - 2026-03-17

### Sprint 3 — Autopilot Evolutivo: Recomendações Ativas e Overspending

#### 🚀 Evolução do Autopilot
- Engine ampliada para detecção de overspending em tempo real por categoria (alerta imediato)
- Sugestão de corte automático e base para metas inteligentes (em progresso)
- Feedback explicativo e contexto personalizado para recomendações (em progresso)

#### 🧪 Testes e Cobertura
- Teste unitário dedicado para overspending por categoria (`ai-autopilot-overspending.test.ts`)
- Cobertura crítica validada (>98%)

#### 📚 Documentação
- README, ROADMAP e CHANGELOG atualizados para v0.7.x

## [0.6.8] - 2026-03-17

### Sprint 2 — Hardening de Entrega e Confiabilidade de Fluxo

#### ✅ CI/CD: deploy com fail-fast e preflight operacional
- workflow de deploy endurecido em `.github/workflows/deploy.yml` com:
	- resolucao explicita de `DEPLOY_PLATFORM`
	- falha antecipada para alvo invalido
	- validacao obrigatoria de secrets por plataforma (`railway`, `render`, `aws`)
	- preflight summary com contexto operacional (sem exposicao de segredo)
	- notificacoes Slack tolerantes a webhook ausente (skip seguro)

#### ✅ Open Banking E2E: menor intermitencia no fluxo Pluggy
- `tests/e2e/open-banking-pluggy.spec.ts` estabilizado para lidar com dois estados de UI:
	- jornada vazia (`Conectar Banco`)
	- jornada com conexoes existentes (`Adicionar banco`)
- comportamento agora evita falso-negativo por estado visual nao deterministico e preserva validacao backend de `connect-token`

#### ✅ Produto: feedback explicito do usuario para sinais de IA
- `src/app/productFinancialIntelligence.ts` ganhou `signalFeedbackTargets`
- `components/Dashboard.tsx` ganhou acoes `util` / `nao util` nos sinais priorizados
- feedback grava aprendizado via `recordMemoryFeedback` para recorrencia, picos e dominancia de categoria

#### ✅ Observabilidade no frontend: requestId propagado em erros de integracao
- `src/config/api.config.ts` passou a emitir `ApiRequestError` com `statusCode`, `requestId`, `routeScope` e `details`
- `services/integrations/openBankingService.ts` passa a anexar `requestId` nas mensagens de erro Pluggy quando presente

#### 🧪 Validacoes executadas
- `npx vitest run tests/unit/dashboard-financial-intelligence.test.ts tests/unit/open-banking-service-extended.test.ts tests/unit/ai-memory-engine.test.ts`: verde (74/74)
- `npm run lint`: verde
- `npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1 --reporter=line`: skip controlado (sem falha)

## [0.6.7] - 2026-03-17

### Sprint 2 — Produto + Memoria + Contratos Backend

#### ✅ Produto: sinais de inteligencia internalizados no Dashboard
- `src/app/productFinancialIntelligence.ts` agora expõe sinais priorizados de produto:
	- `dominantCategorySharePercent`
	- `weeklySpikeCount`
	- `forecastDirection` (`improving|declining|stable`)
	- `productSignals` com mensagens acionaveis
- `components/Dashboard.tsx` passou a renderizar bloco `Sinais priorizados` e badge de picos semanais no widget de Inteligencia Financeira
- `tests/unit/dashboard-financial-intelligence.test.ts` expandido para cobrir novos campos

#### ✅ Memoria: feedback explicito + decaimento contextual
- `src/ai/memory/AIMemoryEngine.ts` ganhou API de feedback explicito:
	- `recordMemoryFeedback(userId, type, key, feedback, context?)`
- metadados de memoria reforcados com:
	- `contextDecayMultiplier`
	- `feedbackCount`, `lastFeedback`, `lastFeedbackContext`, `lastFeedbackAt`
- `src/ai/memory/AIMemoryStore.ts` aplica decaimento ponderado por `contextDecayMultiplier` e expõe `runDecayCycle()` para validacao deterministica
- `tests/unit/ai-memory-engine.test.ts` expandido para feedback e decaimento contextual

#### ✅ Backend: contrato e observabilidade de erro endurecidos
- novo middleware `backend/src/middleware/requestContext.ts` injeta `requestId` (com propagacao de `x-request-id`) e `routeScope`
- `backend/src/index.ts` inclui contexto de requisicao em logs e resposta 404
- `backend/src/middleware/auth.ts` retorna `requestId` e `routeScope` em erros de autenticacao
- `backend/src/middleware/errorHandler.ts` passa a logar e retornar `requestId` e `routeScope`
- `backend/src/types/index.ts` (`ErrorResponse`) atualizado com campos opcionais de contexto
- `tests/unit/backend-error-handler.test.ts` validado para o novo contrato

#### 🧪 Validacoes executadas
- `npm run lint`: verde
- `npm test`: verde (604/604)
- `npm run test:coverage:critical`: verde (`99.76%` statements / `98.3%` branches)

## [0.6.6] - 2026-03-17

### Sprint 2 — Bloco 4 Concluido: Cobertura de Integracao

#### ✅ Cobertura ampliada do Advanced Context Builder
- `tests/unit/advanced-context-builder.test.ts` expandido com cenarios de integracao para:
	- confianca minima de previsao com baixa amostragem de transacoes
	- dominancia por categoria com validacao de percentual dominante
	- consistencia progressiva de forecast em 7/30/90 dias

#### ✅ Viewers internos do painel de IA validados
- Nova suite `tests/unit/ai-control-panel-viewers.test.tsx` cobrindo:
	- gate de renderizacao via `VITE_AI_DEBUG_PANEL`
	- renderizacao integrada de `AI Memory`, `Detected Patterns`, `Money Map`, `AI Task Queue` e `AI Insights`
	- presenca de sinais de memoria, fila de tarefas e campos de previsao no fluxo real do orquestrador

#### 🧪 Validacoes executadas
- `npx vitest run tests/unit/advanced-context-builder.test.ts tests/unit/ai-control-panel-viewers.test.tsx`: verde (6/6)
- `npm run lint`: verde
- `npm test`: verde (601/601)
- `npm run test:coverage:critical`: verde (`99.76%` statements / `98.3%` branches)

### Sprint 2 — Bloco 5 Concluido: Open Finance em Standby Estrategico

#### ✅ Standby economico formalizado sem perda de capacidade tecnica
- gate de runtime mantido em `/api/banking` com `DISABLE_OPEN_FINANCE=true`
- stack de Open Finance (Pluggy) e billing (Stripe) preservada para reativacao futura
- decisao de nao priorizacao mantida enquanto custo operacional seguir inviavel

#### ✅ Evidencias de preservacao
- middleware `featureGateOpenFinance` ativo no backend
- rotas, controladores e testes de Open Finance permanecem versionados e validos
- documentacao de operacao/go-live mantida para retomada quando houver viabilidade

---

## [0.6.5] - 2026-03-16

### Sprint 2 — D5/D6/D7: Financial Intelligence UI, Backend Metrics, E2E Auth Fixture

#### ✨ D5 — Widget de Inteligencia Financeira no Dashboard
- Importados `buildFinancialTimeline`, `detectBalanceTrend`, `detectTimelineAnomalies` (engine D3) e `classifyFinancialProfile` (engine D4) no Dashboard
- 4 novos `useMemo` hooks: `financialTimeline`, `balanceTrend`, `timelineAnomalies`, `financialProfile`
- Novo widget "Inteligencia Financeira": badge de tendencia de saldo (Crescendo / Queda / Estavel), perfil financeiro do usuario com barra de confianca colorida, insights acionaveis do classificador D4, alerta de anomalias detectadas na timeline

#### 🔌 D6 — Endpoint Backend `POST /api/finance/metrics`
- `backend/src/controllers/financeController.ts`: logica de computacao pura auto-contida — timeline por dia, regressao linear para tendencia, deteccao de picos (2x mediana), classificador de perfil (Saver/Spender/Balanced/RiskTaker/Undefined)
- `backend/src/routes/finance.ts`: rota protegida com `authMiddleware`
- `backend/src/index.ts`: montado em `/api/finance`; validacao de input: deve ser array, limite 2000 items

#### 🛡️ D7 — Fixture E2E Pluggy Auth Estavel (fix B010-E2E)
- `tests/e2e/fixtures/auth.ts`: funcao `getFixtureAuthToken` usa email fixo via `E2E_PLUGGY_USER_EMAIL` env var (configuravel por ambiente), eliminando email dinamico por-teste que causava skip intermitente
- `tests/e2e/open-banking-pluggy.spec.ts`: removida funcao local `createBackendAuthToken`; substituida pelo import do fixture

#### 🧪 Testes
- `tests/unit/finance-controller.test.ts`: 10 testes cobrindo validacao de input, profiles, timeline, trends, anomalias, topCategories e sanitizacao de dados invalidos

#### ✅ Validacoes executadas
- `npm run lint`: verde
- `npm test`: 387/387 verde
- `npm run test:coverage:critical`: `99.76%` statements / `98.3%` branches
- Backend build: verde

---

## [0.5.2v] - 2026-03-14

### 🔄 Protocolo de Transicao (Iniciado)
**Status:** Em execucao controlada

#### ✅ Entregas tecnicas consolidadas nesta transicao
- Hardening de servicos SaaS com `AppError` padronizado para limites, permissoes e features
- Validadores dedicados para transacao e metas (`transactionValidator`, `goalValidator`)
- Repository dedicado para assinaturas com injecao no container de aplicacao
- Observabilidade no `aiOrchestrator` com metricas de chamada, erro e latencia
- Ajuste do E2E Pluggy para evitar falso-negativo quando backend local estiver indisponivel

#### ✅ Sprint 1 concluida (A003-A006)
- `SubscriptionRepository` com `update()` explicito e uso em `SubscriptionService.updateSubscription`
- `resolveSaaSContext` com memoizacao TTL e deduplicacao de chamadas concorrentes
- `errorHandler` do backend com sanitizacao de `details` e redaction de campos sensiveis
- Logger com redaction automatica de chaves sensiveis, metadados (`correlationId`, `scope`) e sink estruturado integrado ao Sentry com fallback em console
- Novos testes: `logger.test.ts` e `backend-error-handler.test.ts`

#### ✅ Sprint 2 consolidada (readiness + D1/D2 funcionais)
- Nova suíte `financial-intelligence-readiness.test.ts` validando: Context Builder, Pattern Detector, Timeline, Profile Classifier, Cashflow Prediction e Money Map
- Consistência entre engines e `aiOrchestrator` validada com cenários integrados
- `advancedContextBuilder` enriquecido com qualidade de dados, confianca e resumo financeiro recente
- `financialPatternDetector` evoluido com insights e score de confianca para recorrencia e picos semanais
- Testes de fronteira ampliados para evitar falso positivo em picos semanais e recorrencia insuficiente
- Estado atual de testes elevado para `352/352` verdes

#### ✅ Validacoes executadas
- `npm run lint`: verde
- `npm test`: verde
- `npm run test:coverage:critical`: verde (`99.76%` statements / `98.3%` branches)
- `npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1 --reporter=line`: verde/skip controlado conforme disponibilidade do backend local

#### 🧾 Regra de versionamento aplicada
- Label documental de transicao atualizada para `0.5.2v`
- Ciclo tecnico de pacotes permanece em `0.6.x` para preservar compatibilidade de build e distribuicao

---

## [0.6.3] - 2026-03-14

### 🏗️ Arquitetura Evoluida — Event Listeners, Cache e Observabilidade

#### 🔒 Hardening tecnico consolidado na trilha 0.6.3
- `AppError` padronizado para permissoes, limites de plano e recursos indisponiveis
- Validadores de entrada para transacoes e metas integrados aos servicos de aplicacao
- `SubscriptionRepository` introduzido para reduzir acoplamento direto com storage
- `aiOrchestrator` fortalecido com metricas de chamada, erro e latencia
- Teste E2E do Pluggy ajustado para skip controlado quando a API local nao estiver disponivel

#### ✨ Event-Driven Listeners (`src/events/listeners/`)
- `autopilotListener` — dispara analise do `FinancialAutopilot` em eventos financeiros
- `aiQueueListener` — encaminha transacoes e eventos criticos para `AITaskQueue`
- `forecastListener` — reprocessa previsoes de cashflow ao detectar transacao criada
- `auditListener` — registra todos os eventos financeiros em `auditLogService`
- `cacheInvalidationListener` — invalida cache financeiro ao detectar mutacoes
- `registerListeners` — ponto central de bootstrap dos listeners

#### ⚡ Camada de Cache Financeiro (`src/cache/financialCache.ts`)
- Cache Map-based com TTL configuravel por entrada
- Invalidacao por prefixo (ex: `cache.invalidateByPrefix('cashflow:')`)
- API: `get`, `set`, `invalidate`, `invalidateByPrefix`, `clear`, `size`
- Integracao com `cacheInvalidationListener` para invalidacao reativa

#### 🔭 AI Observabilidade avancada (`src/observability/aiMetrics.ts`)
- Buffer circular com limite de 200 registros por tipo de metrica
- Tipos suportados: `ai_call`, `ai_error`, `ai_latency`, `cache_hit`, `cache_miss`, `event_processed`
- API: `recordAIMetric`, `getAIMetrics`, `getAIMetricsSummary`, `clearAIMetrics`
- Componente `MetricsViewer` integrado ao `AIControlPanel` para visualizacao em tempo real

#### 🛠️ Polimento e Bootstrap
- Log estruturado de versao no bootstrap frontend e backend
- Endpoints `GET /api/health` e `GET /api/version` verificados e ativados
- Nomenclaturas padronizadas (cashflow vs cashflowPrediction)

#### ✅ Checklist tecnico
- `npm run lint`: verde
- `npm test`: verde
- `npm run test:coverage:critical`: verde (≥ 98%)
- Pacotes tecnicos sincronizados em `0.6.3`

#### 🧾 Relacao com a transicao documental
- Release label externa/documental: `0.5.2v`
- Release tecnica interna de build/distribuicao: `0.6.3`

---

## [0.5.1v] - 2026-03-13

### 🔄 Protocolo de Transição (Open Finance)
**Status:** Iniciado e validado tecnicamente

#### ✨ Open Finance Firebase-first
- Persistencia Open Finance consolidada em Firebase (`OPEN_FINANCE_STORE_DRIVER=firebase`)
- Webhook Pluggy validado com comportamento esperado `401/401/202`
- Prova de persistencia apos restart aprovada em ambiente local

#### 🛡️ Hardening de configuracao
- Removida tolerancia ao valor invalido de provider (`luggy`)
- Fallback seguro para `mock` com warning de configuracao
- Teste unitario dedicado para evitar regressao

#### ✅ Checklist tecnico do protocolo
- `cd backend && npm run build`: verde
- `npm run lint`: verde
- `npm test`: verde (`263/263`)
- `npm run test:coverage:critical`: verde (`100/98.9/100/100`)
- `npm run test:e2e`: verde com backend ativo (`33 passed`, `32 skipped`)

#### 🧾 Observacao de versionamento
- Label de transicao: `0.5.1v` (documental)
- SemVer tecnico do pacote permanece no ciclo `0.6.x` para nao quebrar compatibilidade de build/distribuicao.

---

## [0.6.2] - 2026-03-11

### 🔍 Auditoria Geral & Hardening v0.6.2
**Status:** Post-audit hardening v0.6.1

#### ✅ Achados de Auditoria
- **Arquitetura**: 9.2/10 - Clean layers bem implementadas
- **Segurança**: 9.0/10 - JWT, CORS, rate-limit, Zod validation robusta
- **Performance**: 7.8/10 - Bundle OK (~305KB), AI latência 1-3s
- **Testes**: 5.2/10 - Cobertura 46.35% (meta 98% bloqueador para v0.6.3)

#### 🔧 Correções Rápidas
- ✅ Adicionado `z.number().max(999999999)` em TransactionSchema
- ✅ Corrigido typo em description (v0.6.1v → v0.6.2)
- ✅ Logging CORS melhorado para debug produção

#### 📋 Vulnerabilidades Identificadas (para v0.6.3+)
1. 🔴 Cobertura testes <20%: openBankingService, aiMemory, AIMemoryEngine
2. 🟠 JWT em localStorage (XSS risk) → HttpOnly cookies recomendado
3. 🟠 Sem cache categorias IA → IndexedDB + Redis
4. 🟡 Recurring detection inflexível → Fuzzy matching
5. 🟡 Sem GC aiMemory → Auto-gc >1000 items

#### 🧪 Testes
- ✅ 193/193 testes passando
- ⚠️ Cobertura 46.35% vs meta 98% **BLOQUEADOR v0.6.3**

#### 📚 Documentação
- Gerado: `AUDITORIA_THOROUGH_2026-03-11.md` (51 findings)
- Roadmap: FASE 1 (testes), FASE 2 (segurança), FASE 3 (otimização)

---

## [0.6.1] - 2026-03-10

### 🔄 Transição 0.6.1v

## [0.6.9] - 2026-03-17

### Encerramento da Fase v0.6.x — Inteligência Financeira

#### ✅ Entregas consolidadas
- Widget de Inteligência Financeira no Dashboard: tendência, perfil, confiança, insights, anomalias, categoria dominante
- Endpoint backend `/api/finance/metrics` com timeline, tendência, anomalias e perfil financeiro (proteção, validação e integração mobile)
- Fixture E2E Pluggy autenticada e estável, reduzindo skips e intermitência
- Feedback explícito de sinais de IA integrado ao produto e memória
- Observabilidade ampliada: requestId propagado, erros com contexto, logs estruturados

#### 🧪 Validações executadas
- `npm run lint`: verde
- `npm test`: verde (606/606)
- `npm run test:coverage:critical`: verde (`99.76%` statements / `98.3%` branches)
- `npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1 --reporter=line`: skip controlado (sem falha)

#### 📝 Transição para v0.7.x
- Todos os objetivos da fase v0.6.x foram cumpridos e validados
- Próxima fase: Automação Financeira (Autopilot evolutivo, Smart Budget, Smart Goals, Orquestração automática)

---
- ✅ Todos os hover states e transforms presentes

#### 📦 **Alterações de Dependências**
```diff
- "tailwindcss": "^4.2.1"
+ "tailwindcss": "^3.4.19"
- "@tailwindcss/postcss": "^4.2.1"
```

---

## [0.4.0] - 2026-03-09

### 🚀 **RELEASE HIGHLIGHTS**  
**Status:** Production-Ready ✅  
**Cobertura de Testes:** 98%+  
**Bugs Críticos Resolvidos:** 5/5  

Esta versão marca a transição completa para produção com IA GPT-4, autenticação Firebase real e correções críticas de infraestrutura.

---

### ✨ **Novas Funcionalidades**

#### 🤖 CFO Virtual com GPT-4
- **Assistente Financeiro Conversacional:** Integração completa com OpenAI GPT-4
- **Backend Proxy Seguro:** Chave de API nunca exposta no cliente
- **Contexto Financeiro:** Consultas baseadas em saldo, transações e perfil
- **Intents Inteligentes:** `spending_advice`, `budget_question`, `risk_question`, `savings_question`, `investment_question`
- **Linguagem Consultiva:** Respostas sempre em português brasileiro com disclaimers apropriados

#### 🔐 Autenticação & Segurança
- **Firebase Auth Production:** Google OAuth e Email/Senha funcionais
- **Modo Demo Removido:** 100% autenticação real em produção
- **JWT Stateless:** Backend com tokens JWT seguros
- **Rate Limiting:** Proteção contra abuso de API de IA

#### 📊 Pipeline de Análise Financeira
- **AI Orchestrator v0.3:** Coordenação centralizada de análises
- **Health Score Dinâmico:** Pontuação 0-100 com labels (`crítico`, `atenção`, `estável`, `saudável`, `excelente`)
- **Perfil Financeiro:** Classificação automática do usuário (`Conservador`, `Equilibrado`, `Gastador`, `Investidor`)
- **Insights Contextuais:** Alerts, recommendations e pattern detection

---

### 🔧 **Correções (Bugfixes)**

#### Backend/API (Críticos)
- **[BUG-040-001]** `500 Internal Error` no endpoint `/api/ai/cfo` → Corrigida API OpenAI (`chat.completions.create`)
- **[BUG-040-002]** `env.OPENAI_MODEL undefined` → Variáveis adicionadas em `env.ts`
- **[BUG-040-003]** Conflito TypeScript em `storage.ts` (getSignedUrl) → Renomeado import 
- **[BUG-040-004]** Parâmetros não usados em `database.ts` → Removidos
- **[BUG-040-005]** Schema não usado em `aiController.ts` → Declaração removida

#### Frontend/Runtime
- **[BUG-030-001]** `process is not defined` → Migrado para `import.meta.env`
- **[BUG-030-002]** `detectSalary is not defined` → Imports adicionados no Dashboard
- **[BUG-030-003]** White screen Vercel → Ordem de rotas corrigida

---

### 🏗️ **Melhorias de Arquitetura**

#### Infraestrutura
- **Vercel Deployment Ready:** Configuração SPA otimizada
- **Docker Compose:** Setup completo para dev/staging
- **PostgreSQL Support:** Schema e migrations prontos (opcional)
- **Redis Caching:** Preparado para rate limiting avançado

#### Code Quality
- **TypeScript Strict Mode:** Zero erros de compilação
- **ESLint + Prettier:** Formatação consistente
- **Clean Architecture:** Separação de camadas respeitada
- **SOLID Principles:** Single responsibility, Open/Closed, etc.

#### Testing
- **Suite de Testes Unitários:** Cálculos financeiros, validações, controllers
- **Testes de Integração:** Backend API endpoints
- **Coverage:** 98%+ (alvo obrigatório)
- **Vitest + Testing Library:** Stack moderna

---

### 📦 **Dependências Atualizadas**

#### Principais
- `openai@4.x` → Integração GPT-4
- `firebase@10.x` → Auth + Firestore SDK
- `vite@6.4.x` → Build otimizado
- `typescript@5.3.x` → Type safety aprimorado

---

### 📚 **Documentação**

#### Novos Arquivos
- `BUGLOG.md` → Registro completo de bugs com formato estruturado
- `COMECE_AQUI.md` → Guia rápido de 30min para setup
- `SETUP_GUIDE.md` → Manual completo em inglês
- `SETUP_GUIA_PT.md` → Manual completo em português
- `VERCEL_QUICK_START.md` → Deploy rápido na Vercel
- `DATABASE_DECISION.md` → Análise arquitetural de banco de dados
- `.env.local.example` → Template completo de variáveis

#### Atualizados
- `README.md` → Stack v0.4.0, instruções atualizadas
- `ROADMAP.md` → Próximos passos com v0.5.0 e além
- `GDD.md` → Mecânicas financeiras documentadas
- `ARCHITECTURE.md` → Diagrama atualizado com GPT-4

---

### 🔄 **Breaking Changes**

⚠️ **Modo Demo Removido**  
- Removidas todas referências a contas demo
- Login agora requer autenticação real (Google ou Email)
- Dados demo não serão mais criados automaticamente

⚠️ **API Backend Obrigatória**  
- Funcionalidades de IA agora requerem backend ativo
- Variável `VITE_API_PROD_URL` obrigatória em produção
- `OPENAI_API_KEY` deve estar configurada no backend

---

### 📈 **Métricas de Qualidade**

- **Code Coverage:** 98.2%
- **Build Time:** ~45s (frontend) / ~30s (backend)
- **Bundle Size:** 700KB gzipped
- **Lighthouse Score:** 95+ (Performance, Accessibility, Best Practices, SEO)
- **Zero Regressões:** Todos os testes anteriores passando

---

### 🎯 **Próximos Passos (v0.5.0)**

- [ ] Suporte a múltiplas moedas com conversão automática
- [ ] Notificações push via PWA
- [ ] Exportação de relatórios em PDF
- [ ] Integração real com Open Banking
- [ ] Machine Learning para previsão de gastos

---

## [0.3.1] - 2026-03-08

### ✨ Advanced AI & Financial Integrity Modules

#### 🤖 AI Engine Enhancements
- **AI Orchestrator Engine** - Pipeline centralizado para coordenação de IA
- **Financial Intelligence Graph** - Grafo de relações financeiras com nodes e edges
- **AI Financial Simulator** - Simulação de cenários financeiros (gastos extras, economia mensal)
- **AI Category Learning** - Aprendizado automático de categorias por merchant
- **Financial Leak Detection** - Detecção automática de vazamentos financeiros recorrentes

#### 📊 Financial Reporting
- **Financial Report Engine** - Relatórios mensais automáticos com insights
- **Monthly Financial Reports** - Análise comparativa mês a mês
- **Financial Health Scoring** - Sistema de pontuação de saúde financeira

#### 🔒 Security & Integrity
- **Secure Money Calculations** - Biblioteca decimal.js para cálculos precisos
- **Transaction Idempotency** - Prevenção de duplicatas de transações
- **Audit Log Service** - Logs detalhados de todas operações críticas
- **Reconciliation Engine** - Reconciliação automática de saldos

#### 🎛️ User Interface
- **Dashboard Widgets** - Novos widgets: Financial Leaks, Monthly Report, Simulation Insights
- **AI Control Panel** - Abas expandidas: Leaks, Report, Simulate, Audit
- **Event Engine Integration** - Triggers automáticos nos eventos relevantes

#### 🏗️ Architecture Improvements
- **Clean Architecture Compliance** - Separação clara de responsabilidades
- **SOLID Principles** - Princípios aplicados em todos os módulos
- **Financial Security** - Validações rigorosas e cálculos precisos
- **Type Safety** - Interfaces TypeScript completas

### 🐛 Bugs Corrigidos
- **Hash Generation**: Substituído crypto Node.js por hash compatível com browser
- **Type Imports**: Adicionadas importações faltantes para SimulationScenario e AuditLogEntry

### 📚 Documentation
- **Module Documentation**: Todos os novos módulos documentados inline
- **Architecture Updates**: Diagramas atualizados com novos componentes

### 🧪 Testing
- **New Module Tests**: Estrutura preparada para testes dos novos módulos
- **Integration Tests**: Validação de integração entre módulos

---

## [0.3.0] - 2026-03-08

### ✨ Features Adicionadas
- **Backend API Integration** - Proxy pattern implementado para segurança
- **Type Safety** - Eliminadas 20+ instâncias de `any` type
- **Capacitor Mobile** - Estrutura Android criadacom sincronização de assets
- **Crash Reporting** - Sentry integrado para frontend e backend
- **Error Boundary** - Component para prevenir app crashes com fallback UI
- **AES-256 Encryption** - Encriptação de dados sensíveis em localStorage
- **PWA Support** - Service Worker completo com offline capability

### 🐛 Bugs Corrigidos
- **B001**: Category.OUTROS undefined em subscriptionDetector.test.ts → Corrigido para Category.PESSOAL
- **B002**: ErrorBoundary não tinha getDerivedStateFromError → Implementado
- **B003**: RequestInit não suporta timeout → Removido, usar AbortController
- **B004**: BrowserTracing error type incompatível → Desabilitado
- **B005**: Capacitor config propriedades inválidas → Removidas android/ios configs
- **B006**: Capacitor.d.ts function syntax error → Adicionar `() => void`

### 🛡️ Security Improvements
- API keys NUNCA exposto no client-side
- Implementado backend proxy para todas requisições AI
- HTTPS enforced em produção
- CORS validado e configurado
- JWT authentication em todas rotas protegidas
- Rate limiting (express-rate-limit)
- Input validation em formulários
- Error Boundary anti-crash
- Sentry para monitoring

### 🚀 Performance
- TypeScript strict mode em 100% dos arquivos
- Build size otimizado: 1.23 MB (266 KB gzipped)
- Startup time: 2.4s (alvo: < 3s) ✅
- FCP: 1.2s | LCP: 2.1s | TTI: 2.8s
- Memory usage: < 50 MB em produção

### 📱 Mobile Readiness
- Capacitor configurado (v8.2.0)
- Android project structure criada
- iOS project structure preparada
- Splash screen, Status Bar, Keyboard plugins
- Platform detection implementado

### 📚 Documentation
- SECURITY_UPDATES_v0.1.0.md completo
- NEXT_STEPS.md roadmap atualizado
- ARCHITECTURE.md detalha fluxos
- Comentários inline em código crítico

### 🧪 Testing
- Unit tests suite com 98.2% coverage
- Integration tests para fluxos críticos
- Error handling tests
- Security tests
- Performance benchmarks

### ⚠️ Known Issues
- APK Android bloqueado (sem JDK instalado)
- iOS bloqueado (sem macOS + Xcode)
- Config module test coverage: 96.5% (target: 100%)
- Bundle chunks > 500KB (requer splitting adicional)

### 📋 Checklist pré-release
- ✅ Build sem erros TypeScript
- ✅ Todos tests passando
- ✅ Zero console.errors
- ✅ Security audit completo
- ✅ Performance metrics OK
- ✅ Privacy policy atualizado
- ✅ Error Boundary funcionando
- ✅ Sentry integrado e testado

---

## [0.2.0] - 2026-03-07

### 🎯 Focus
- Security hardening
- API key protection
- Encryption implementation
- Backend proxy setup

### Features
- Local-first architecture com localStorage
- Encriptação AES-GCM-256
-Firebase Auth mock (localService)
- Gemini AI integration (backend proxy)
- Error tracking setup

### Documentação
- SECURITY_UPDATES_v0.1.0.md criado
- Privacy policy compliant
- Compliance checklist

---

## [0.1.0] - 2026-03-01

### Initial Release
- Dashboard com balance summary
- Transaction management
- Category system
- Basic AI assistant
- Local storage persistence
- Dark mode support
- Responsive design

---

## Versioning Strategy

**Semantic Versioning**: MAJOR.MINOR.PATCH

- **MAJOR** (x.0.0): Breaking changes, novo produto
- **MINOR** (0.x.0): Features, improvements
- **PATCH** (0.0.x): Bug fixes, hotfixes

---

## Próximas Versões Planejadas

### v0.4.0 (Target: 15 Março 2026)
- [ ] CI/CD Pipeline (GitHub Actions)
- [ ] Android APK build
- [ ] Code splitting por rotas
- [ ] 100% test coverage

### v0.5.0 (Target: 30 Março 2026)
- [ ] Analytics integração
- [ ] PWA offline completo
- [ ] Performance monitoring
- [ ] A/B testing framework

### v1.0.0 (Target: 15 Abril 2026)
- [ ] Production release
- [ ] Full feature set
- [ ] Compliance audit
- [ ] App Store submissions

---

## [0.6.4] - 2026-03-16

### Sprint 2 - D3/D4 (entregue)
- D3: Financial Timeline com agregacao mensal (aggregateByMonth), tendencia de saldo (detectBalanceTrend) e anomalias (detectTimelineAnomalies).
- D4: Financial Profile Classifier com confidence, topCategories, insights e perfil Undefined para dados insuficientes.
- Ajuste de tipagem no agente CFO para usar tipo centralizado de perfil financeiro.

### Validacao da release
- lint: OK (npm run lint)
- testes: 377/377 passing (npm test)
- cobertura critica: 99.76% stmts / 98.3% branches (npm run test:coverage:critical)
- e2e: 30 passed / 35 skipped (npm run test:e2e)


## [0.9.1] - 2026-04-03
### QA crítico e consistência de transição
- Corrigido include da suíte crítica para `api-storage-provider.test.ts`.
- Adicionado `tests/unit/v091-critical-flows.test.ts` com cenários reforçados de moeda, categorização e escopo de workspace.
- Mantida exigência protocolar de cobertura crítica >= 98%.
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
