# CHANGELOG - Flow Finance

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

- [Go/No-Go Decision](docs/GO_NO_GO_DECISION_2026-04-12.md) - Validações e decisão operacional
- [Plano de 10 Dias](docs/PLANO_LANCAMENTO_10_DIAS_2026-04-12.md) - Roadmap pós-lançamento
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
**Última Atualização**: 2026-04-12  
**Responsabilidade**: Flow Finance Team + AI Engineering
