# CHANGELOG - Flow Finance

## [Unreleased]

---

## [0.9.7] - 2026-05-05

### Qualidade de Código — Passagem de 7 Trilhas

#### Track 1 — Deduplicação de inicialização Firebase Admin
- `firestoreAdmin.ts` criado como ponto único de inicialização; todos os consumidores atualizados

#### Track 2 — Consolidação de tipos
- Bug de `UserRole` corrigido; `ResourceKind`, `FeatureKey` e `BillingHookPayload` consolidados

#### Track 3 — Remoção de código morto
- 3 componentes não utilizados deletados

#### Track 4 — Dependências circulares
- Validadas e sem ocorrências

#### Track 5 — Fortalecimento de tipos
- `predictions.ts`: `(doc: any)` / `(t: any)` → tipos explícitos com helper `docToTransaction()`
- `Assistant.tsx`: 8 ocorrências de `as any` removidas com cast tipado preciso
- `ClinicAutomationService.ts`: `payload as any` removido; union discriminada resolve via narrowing do TypeScript
- `firebaseOptimized.ts`, `AIInput.tsx`, `featureGate.ts`: limpeza complementar de `any`

#### Track 6 — Tratamento de erros
- `adminController.ts`, `bankingController.ts`, `saas.schema.ts`: catch blocks documentados
- `ClinicAutomationService.ts`: `catch {}` vazio → `logger.warn` com contexto
- `redis.ts`: tipos `NodeJS.ErrnoException` e `Record<string, unknown>` em callbacks de retry

#### Track 7 — Remoção de AI slop
- `ClinicAIEnrichmentQueue.ts`, `typeMappers.ts`, `bankingController.ts`: comentários redundantes removidos

### Billing — Postgres como Fonte de Verdade

- **`saasStore.ts`**: `persistState()` virou `async`; `await saveWorkspaceSaasState()` — falha no Postgres propaga para o caller (HTTP 500) em vez de ser silenciada. 9 funções de escrita exportadas tornadas `async Promise<void|number>`: `setUserPlan`, `setUserUsage`, `setWorkspaceUsage`, `incrementMonthlyUsage`, `incrementWorkspaceMonthlyUsage`, `recordWorkspaceUsage`, `resetWorkspaceUsage`, `appendBillingHook`, `appendWorkspaceBillingHook`. Legacy JSON blob continua fire-and-forget com `logger.warn`.
- **`billingService.ts`**: `applyPlanChange`, `applyBillingHook`, `changeUserPlan` tornadas `async`; todas as chamadas de escrita com `await`
- **`quota.ts`**: `await incrementWorkspaceMonthlyUsage` / `await incrementMonthlyUsage`
- **`saas.ts`**: `await setWorkspaceUsage`, `recordWorkspaceUsage`, `resetWorkspaceUsage`

### Testes

- **`billing-service.test.ts`**: mock de Postgres adicionado; 6 testes convertidos para `async`/`await`; `expect().toThrow` → `rejects.toThrow` para funções async
- **`saasStore.persistence.test.ts`**: mock de Postgres adicionado; `await` em todas as chamadas de escrita
- **`quota-middleware.test.ts`**: mock de Postgres adicionado; `await` em `incrementMonthlyUsage`/`setUserPlan`; `incrementMonthlyUsage retorna novo total` corrigido
- **`admin-controller-postgres.test.ts`**: expectativa de `limit` corrigida para `100` (default do controller)
- **`saasStore.postgres-billing.test.ts` (NOVO)**: 7 testes de integração cobrindo o path Postgres: payload correto em `saveWorkspaceSaasState`, acúmulo de incrementos, shape de billing hook (campo `id`), propagação de erro, absorção de falha do blob legacy (logger.warn), limpeza via `resetWorkspaceUsage`

### Corrigido (do Unreleased anterior)

- **Versão hard-coded no backend**: Fallback corrigido de `0.9.6` → `0.9.7` em `/health`, `/api/version`, `/api/health` e log de bootstrap
- **Versão hard-coded no frontend**: Fallback corrigido em `versionGuard.ts`, `sentry.ts` e `api.config.ts`
- **Navegação principal**: Tab "Inicio" → "Caixa"; "Apoio IA" → "Consultor IA"
- **Dashboard**: Label "Dashboard" → "Caixa"; botão "Gerenciar contas" → "Consultar saldos"
- **Documentação de variáveis de ambiente**: `backend/.env.example` documenta `CLINIC AUTOMATION INTEGRATION` e `APP_VERSION`

### Segurança (auditoria 2026-05-03)

- **SEC-001 (HIGH) — Open Redirect em returnUrl**: `safeReturnUrl()` valida origem contra `FRONTEND_URL`/`ALLOWED_ORIGINS`
- **SEC-002 (MEDIUM) — DOM XSS em runtimeGuard/versionGuard**: `escapeHtml()` sanitiza antes de `innerHTML`
- **SEC-003 (MEDIUM) — Query params vazando em logs**: `req.query` removido do logging middleware
- **SEC-004 (LOW) — Body parser sem limite explícito**: Limite reduzido de `10mb` → `1mb`

---

## [0.9.6] - 2026-04-12 🚀


### Status: RELEASED

Lançamento de produção com consolidação de fluxo de caixa inteligente e integração completa de IA para automação e consultoria financeira.

### ✅ Adicionado

#### Núcleo Financeiro
- **Dashboard Unificado**: Visão consolidada de saldo, transações, receitas previstas vs realizadas
- **Fluxo de Caixa Projetado**: Visualização de receitas esperadas e padrões de saída
- **Sincronização Bidirecional**: Offline-first com persistência local e sincronização em nuvem
- **Tratamento de Conflitos**: Merge inteligente de mudanças locais e remotas

#### Inteligência Artificial
- **Categorização Automática de Transações**: Gemini por padrão, OpenAI como fallback
- **Consultor IA (CFO)**: Assistente consultivo com recomendações operacionais
- **Contextualizacao por Workspace**: IA responde com dados de negócio do usuário ativo

#### Monetização
- **Billing com Stripe**: Checkout, webhooks, portal de faturas
- **Planos de Acesso**: Free (dashboard básico), Pro (IA + insights), Enterprise
- **Feature Gating**: Acesso condicional a funcionalidades por plano
- **Sincronização de Plano**: Transição automática entre Free/Pro na renovação

#### Observabilidade
- **Contrato de Saúde**: `/health`, `/api/health`, `/api/version` com requestId + routeScope
- **Request Tracing**: Identificação única de requisições para debugging
- **Health Checks de Dependências**: Server, Database, Redis, AI Providers (graceful fallback)
- **Sentry Bootstrap Silencioso**: Pronto para DSN (sem quebra se ausente)

#### Mobilidade
- **Capacitor Integrado**: Web app como PWA e preparado para binários nativos
- **Sincronização Mobile**: Persistência local com suporte offline completo
- **Responsividade**: Design mobile-first validado em múltiplas resoluções

#### Infraestrutura
- **Vercel Deployment**: Frontend static + backend API separados, ambos otimizados
- **Type Safety**: 100% TypeScript em app e backend
- **Test Coverage**: 119 arquivos de teste, >98% cobertura crítica
- **CI/CD Opcional**: Docker, GitHub Actions com guards de configuração

### 🔧 Corrigido

- Validador de health check agora aceita GET / = 404 para backends API-only
- Alinhamento de versão (APP_VERSION + VITE_APP_VERSION) entre frontend e backend
- Requestid e routeScope garantidos em todas as respostas (MESMO EM 404)
- Silent Sentry bootstrap (não quebra se DSN ausente)

### 📦 Dependências Atualizadas

- React 19.2.4
- Vite 8.0.8
- Express 5.2.1
- Firebase Admin SDK 13.7.0
- Stripe 16.x
- Capacitor 8.2.0
- Gemini (Google AI) integrado
- OpenAI integrado como fallback

### ⚠️ Limitações Conhecidas

- **Observabilidade Avançada**: Sentry DSN requer configuração manual em variáveis de produção (código pronto)
- **Mobile Native**: Binários iOS/Android não inclusos nesta release (web PWA disponível)
- **Open Finance**: Integração Pluggy presente mas inativa (feature flag: FEATURE_OPEN_FINANCE=false)

### 🚫 Removido

- Open Banking interface da experiência principal (ainda configurável em dev)
- Analytics basic (será re-implementado em v0.10.0)
- Dark mode toggle (planejado para v0.10.0)

### 📋 Checklist de Validação

- [x] Backend saúde validado: `/health`, `/api/health`, `/api/version` = 200 OK
- [x] Frontend acessível: HTTP 200 com assets sendo servidos
- [x] Versão sincronizada: 0.9.6 em ambos os lados
- [x] Testes passando: 119 arquivos, >98% cobertura crítica
- [x] Lint aprovado: Zero erros TypeScript
- [x] Stripe validado: Checkout + Webhook + Portal em sandbox
- [x] IA operacional: Gemini + OpenAI fallback testados
- [x] Sync offline: Persistência local + cloud OK
- [x] Capacitor: PWA pronto, mobile web respondendo

### 📚 Documentação

- [Go/No-Go Decision](docs/archive/GO_NO_GO_DECISION_2026-04-12.md) - Validações e decisão operacional
- [Plano de 10 Dias](docs/archive/PLANO_LANCAMENTO_10_DIAS_2026-04-12.md) - Roadmap pós-lançamento
- [Deployment Status](docs/DEPLOYMENT_STATUS.md) - Histórico de execução
- [Architecture](docs/ARCHITECTURE.md) - Visão técnica do sistema

### 🔗 Links de Produção

- **Frontend**: https://flow-finance-frontend-nine.vercel.app/
- **Backend**: https://flow-finance-backend.vercel.app/
- **Status Page**: https://flow-finance-backend.vercel.app/api/health

---

## [0.6.0] - Earlier Versions

[Histórico anterior consolidado em versões anteriores. Veja git log para detalhes completos.]

---

## Notas de Desenvolvimento

### Próximas Fases (Roadmap v0.10.0+)

**Fase 2 (Dia 4)**: Observabilidade avançada - Ativação de Sentry DSN, session replay, error tracking centralizado

**Fase 3 (Dia 6)**: Hardening técnico - Refactor Open Finance, redução de debt, otimizações de performance

**Fase 4**: Mobile native - Binários iOS/Android, app store deployment

**Roadmap Futuro**: Dark mode, Analytics avançado, Integrações bancárias, Exportação de dados, Webhooks customizáveis

---

**Versionamento**: Semântico (MAJOR.MINOR.PATCH)  
**Última Atualização**: 2026-04-13  
**Responsabilidade**: Flow Finance Team + AI Engineering
