ï»¿## Monitoramento de IntegraÃ§Ãµes Externas
O sistema recomenda configurar alertas/logs para Pluggy, Stripe e Firebase. ApÃ³s cada deploy, monitore falhas, lentidÃ£o e quedas de serviÃ§o. Exemplos de boas prÃ¡ticas:
- Ativar logs detalhados de erro e sucesso
- Configurar alertas automÃ¡ticos (ex: via Sentry, Firebase Crashlytics)
- Validar respostas e tempos de integraÃ§Ã£o periodicamente


# Flow Finance - Controle de Fluxo de Caixa Inteligente

**Versao:** 0.9.4  
**Ultima Atualizacao:** 6 de Abril de 2026  
**Status:** Release pronta para deploy separado frontend/backend no Vercel com auth por cookie HttpOnly, sync localStorage->Firestore e smoke test operacional

Bem-vindo ao **Flow Finance**, uma aplicaÃ§Ã£o moderna para gestÃ£o financeira pessoal e profissional, equipada com assistente de IA para facilitar o lanÃ§amento de despesas e receitas.

## ðŸš€ VisÃ£o Geral

O Flow Finance Ã© uma plataforma completa de gestÃ£o financeira com IA, desenvolvida com **React + Vite**, **Firebase** (auth/data) e backend com **OpenAI GPT-4 ou Gemini** (configurÃ¡vel, via proxy seguro). O projeto segue arquitetura **Clean Architecture** com separaÃ§Ã£o clara de responsabilidades.

## Checkpoint de Release 0.9.4

- Migracao de auth para cookies HttpOnly com `SameSite=None` em producao para frontend e backend em dominios separados.
- OAuth Google endurecido com allowlist de `redirectUri`.
- Export CSV administrativo protegido contra formula injection.
- Handlers de integracao clinica deixam de reportar falso sucesso quando ainda nao implementados.
- Sync write-through de metas: localStorage imediato + push/pull via backend para Firestore.
- Script operacional de smoke test criado em `scripts/smoke-prod-auth-sync.ps1`.
- Hotfix no backend: `/health` nao retorna mais falso `503` quando Postgres nao esta configurado para o ambiente atual.


### Principais Funcionalidades (v0.8.x)

-   **Dashboard Interativo:** VisÃ£o geral de receitas, despesas e saldo com grÃ¡ficos animados.
-   **Assistente de IA (CFO Virtual):** Consultas financeiras em linguagem natural via backend com OpenAI/Gemini.
-   **AnÃ¡lise Financeira Automatizada:** Pipeline de IA para insights, detecÃ§Ã£o de riscos, perfil financeiro, money map, previsÃ£o de cashflow e recomendaÃ§Ãµes ativas do Autopilot.
-   **GestÃ£o de TransaÃ§Ãµes:**
   - Adicione, edite, categorize e importe transaÃ§Ãµes (CSV/OFX).
   - **EdiÃ§Ã£o de categoria com sugestÃ£o automÃ¡tica de IA**: ao editar, o sistema sugere a categoria mais provÃ¡vel com base no merchant.
   - **BotÃ£o "Desfazer"**: permite restaurar a categoria anterior instantaneamente, com feedback visual.
   - **Acessibilidade e feedback visual aprimorados**: modal com foco automÃ¡tico, atalhos e feedback de sucesso.
   - **Cobertura de testes**: fluxo validado por testes unitÃ¡rios e E2E.
-   **Metas e Alertas Inteligentes:** Defina objetivos financeiros, receba alertas de overspending em tempo real por categoria, sugestÃµes de corte automÃ¡ticas (com valor sugerido) e metas automÃ¡ticas de corte, economia e reserva de emergÃªncia geradas por IA.
-   **Open Banking (Pluggy + Mock):** Fluxo real via backend protegido com fallback local para desenvolvimento.
-   **Scanner de Recibos:** OCR para extrair dados de comprovantes (Tesseract.js com fallback e integraÃ§Ã£o opcional por IA no backend).
-   **Central de Apoio:** Acesso rÃ¡pido a suporte via IA, contato e documentos legais.
-   **Modo Escuro/Claro:** Interface adaptÃ¡vel Ã  sua preferÃªncia.
-   **Totalmente Responsivo:** Funciona bem em desktop e mobile (PWA pronto).

---

## ðŸ“¦ Stack TecnolÃ³gica (v0.7.x)

### Frontend
- **React 19** + **TypeScript 5.8**
- **Vite 6** (build otimizado)
- **TailwindCSS 3** (UI responsiva)
- **Firebase SDK** (Auth + Firestore)
- **Recharts** (grÃ¡ficos) + **Lucide React** (Ã­cones)
- **Capacitor** (iOS/Android deployment)

### Backend
- **Node.js 20** + **Express 4**
- **TypeScript 5.3**
- **OpenAI SDK** e **Gemini SDK** (fallback e configuraÃ§Ã£o por ambiente)
- **PostgreSQL** (persistÃªncia futura opcional para Open Finance)
- **JWT** (autenticaÃ§Ã£o stateless)
- **Pino** (logging estruturado)

---

## ðŸ§° Development Utilities

```bash
# Limpeza de dados (Firestore + backend/data)
npm run db:reset

# SeguranÃ§a: varredura de secrets em arquivos versionados
npm run security:scan-secrets

# Qualidade
npm run lint
npm test
npm run test:coverage:critical
npm run test:e2e
```

### Cloud & Deploy
- **Frontend:** Vercel (SPA estÃ¡tico)
- **Backend:** Vercel Serverless Functions / Railway
- **Database:** Firebase Firestore (produÃ§Ã£o)
- **Storage:** Firebase Storage (recibos)
- **Monitoring:** Sentry (error tracking)

### CI/CD Operational Notes

- Build and Test Docker stage is opt-in via repository variable `ENABLE_DOCKER_BUILD=true`.
- Deploy pipeline target is controlled by repository variable `DEPLOY_PLATFORM` with valid values: `railway`, `render`, `aws`.
- If `DEPLOY_PLATFORM` is not configured, deploy workflow safely skips external deployment steps.
- Detailed runbook: `docs/CI_DOCKER_OPTIN_OPERATION.md`.

### AI CFO - SeguranÃ§a Operacional
- Endpoint: `POST /api/ai/cfo` via backend proxy seguro.
- ProteÃ§Ãµes ativas: autenticaÃ§Ã£o JWT, contexto de workspace, rate limit por usuÃ¡rio e quota de uso (`aiQueries`).
- Payload validado em schema (limites de tamanho para `question/context` e `intent` restrito).
- Provider de IA configurÃ¡vel por ambiente: OpenAI com fallback para Gemini.
- Resposta sempre consultiva, sem garantia financeira absoluta e sem inferÃªncia fora do contexto enviado.

---

## Docker Setup & Deployment

### PrÃ©-requisitos

- Docker & Docker Compose
- Node.js 18+ (para desenvolvimento local)
- Git

### ðŸš€ ExecuÃ§Ã£o com Docker

1. **Clone o repositÃ³rio:**
   ```bash
   git clone https://github.com/Gehlenn/Flow-Finance.git
   cd Flow-Finance
   ```

2. **Configure as variÃ¡veis de ambiente:**
   ```bash
   cp .env.example .env
   # Edite o .env com suas configuraÃ§Ãµes
   ```

3. **Execute com Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Acesse a aplicaÃ§Ã£o:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

### ðŸ› ï¸ Desenvolvimento Local

1. **Instale dependÃªncias:**
   ```bash
   npm install
   cd backend && npm install
   ```

2. **Configure o banco de dados:**
   ```bash
   # Com Docker
   docker run -d --name postgres-dev -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:15
   docker run -d --name redis-dev -p 6379:6379 redis:7
   ```

3. **Execute os serviÃ§os:**
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   cd backend && npm run dev
   ```

### âœ… Checkpoint de TransiÃ§Ã£o 0.5.2v

- Hardening SaaS aplicado com padronizacao de erros de permissao, limite e feature
- Validadores de entrada para transacoes e metas adicionados ao fluxo de servicos
- Observabilidade de IA ampliada com metricas de chamada, erro e latencia
- E2E do Pluggy estabilizado com skip controlado quando backend local nao estiver disponivel
- Cobertura critica validada em `99.76%` statements e `98.3%` branches no recorte protocolar
- Sprint 1 concluida: `SubscriptionRepository.update()`, memoizacao de `resolveSaaSContext`, sanitizacao de `AppError.details` e redaction no logger

> Nota de versionamento: a label documental desta transicao e `0.5.2v`, enquanto o ciclo tecnico interno de pacotes permanece na trilha `0.6.x` para compatibilidade operacional.

### ðŸ—ï¸ Build Manual

```bash
# Frontend
npm run build

# Backend
cd backend && npm run build

# Executar
npm run preview  # Frontend
cd backend && npm start  # Backend
```

---

## ðŸ› ï¸ Arquitetura SaaS - Clean Architecture

O Flow Finance foi completamente refatorado para uma arquitetura SaaS escalÃ¡vel seguindo os princÃ­pios de **Clean Architecture**, **DDD (Domain Driven Design)**, **SOLID** e **event-driven architecture**.

### Camadas da Arquitetura

```
src/
â”œâ”€â”€ domain/           # ðŸ›ï¸  Camada de DomÃ­nio (Domain Layer)
â”‚   â””â”€â”€ entities.ts   # Entidades de negÃ³cio com regras invariantes
â”œâ”€â”€ app/              # ðŸš€ Camada de AplicaÃ§Ã£o (Application Layer)
â”‚   â””â”€â”€ services.ts   # ServiÃ§os de aplicaÃ§Ã£o e coordenaÃ§Ã£o
â”œâ”€â”€ storage/          # ðŸ’¾ Camada de Infraestrutura (Infrastructure Layer)
â”‚   â””â”€â”€ StorageProvider.ts # AbstraÃ§Ã£o de persistÃªncia
â”œâ”€â”€ ai/               # ðŸ¤– MÃ³dulos de IA
â”œâ”€â”€ finance/          # ðŸ’° Engines financeiros
â”œâ”€â”€ security/         # ðŸ”’ SeguranÃ§a e integridade
â”œâ”€â”€ events/           # ðŸ“¡ Sistema de eventos
â””â”€â”€ config/           # âš™ï¸  ConfiguraÃ§Ã£o e DI
```

### PrincÃ­pios Implementados

- **ðŸ›ï¸ Clean Architecture:** SeparaÃ§Ã£o clara entre domÃ­nio, aplicaÃ§Ã£o e infraestrutura
- **ðŸ“¦ SOLID Principles:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **ðŸŽ¯ Domain Driven Design:** Entidades focadas em regras de negÃ³cio
- **ðŸ“¡ Event-Driven:** ComunicaÃ§Ã£o desacoplada via sistema de eventos
- **ðŸ”„ Dependency Injection:** InjeÃ§Ã£o de dependÃªncias para testabilidade
- **ðŸ›¡ï¸ Type Safety:** TypeScript rigoroso em todas as camadas

### ServiÃ§os de AplicaÃ§Ã£o

- **UserService:** Gerenciamento de usuÃ¡rios
- **TransactionService:** OperaÃ§Ãµes com transaÃ§Ãµes
- **AccountService:** Gerenciamento de contas
- **GoalService:** Metas financeiras
- **SimulationService:** SimulaÃ§Ãµes financeiras
- **ReportService:** RelatÃ³rios e anÃ¡lises
- **SubscriptionService:** Assinaturas recorrentes
- **BankConnectionService:** ConexÃµes bancÃ¡rias

### Provedores de Armazenamento

- **LocalStorageProvider:** Para desenvolvimento e testes locais
- **ApiStorageProvider:** Para integraÃ§Ã£o com backend API

Para detalhes profundos sobre o fluxo de dados e diagramas, consulte o arquivo [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## ðŸ“Š Monitoramento

### Sentry (Error Tracking)
Configure o DSN no `.env`:
```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Health Checks
- `/health` - Status geral do sistema
- `/api/version` - VersÃ£o da API

### Logs
```bash
# Ver logs do Docker
docker-compose logs -f

# Logs especÃ­ficos
docker-compose logs backend
docker-compose logs frontend
```

## ðŸ”’ SeguranÃ§a

### Headers de SeguranÃ§a
- Helmet.js configurado
- CORS configurado
- Rate limiting ativo
- Content Security Policy

### AutenticaÃ§Ã£o
- JWT tokens
- bcrypt para hash de senhas
- SessÃµes Redis

### Rate Limiting
- API geral: 10 req/segundo
- Auth endpoints: 5 req/minuto

## ðŸ§ª Testes

```bash
# Todos os testes
npm run test

# Com coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## ðŸ“š DocumentaÃ§Ã£o Adicional

- [Arquitetura SaaS](./docs/SAAS_ARCHITECTURE.md)
- [Guia de Desenvolvimento](./docs/CONTRIBUTING.md)
- [API Documentation](./backend/README.md)
- [Archive de Versoes Anteriores](./docs/archive/README.md)

---

## ðŸ“‚ Estrutura de Pastas

```text
â”œâ”€â”€ components
â”‚   â”œâ”€â”€ AIInput.tsx
â”‚   â”œâ”€â”€ Analytics.tsx
â”‚   â”œâ”€â”€ Assistant.tsx
â”‚   â”œâ”€â”€ CashFlow.tsx
â”‚   â”œâ”€â”€ Dashboard.tsx
â”‚   â”œâ”€â”€ LegalModal.tsx
â”‚   â”œâ”€â”€ Login.tsx
â”‚   â”œâ”€â”€ Logo.tsx
â”‚   â”œâ”€â”€ NamePromptModal.tsx
â”‚   â”œâ”€â”€ OpenFinance.tsx
â”‚   â”œâ”€â”€ Settings.tsx
â”‚   â”œâ”€â”€ SpendingAlerts.tsx
â”‚   â””â”€â”€ TransactionList.tsx
â”œâ”€â”€ services
â”‚   â”œâ”€â”€ firebase.ts
â”‚   â”œâ”€â”€ geminiService.ts
â”‚   â””â”€â”€ localService.ts
â”œâ”€â”€ .gitignore
â”œâ”€â”€ App.tsx
â”œâ”€â”€ ARCHITECTURE.md
â”œâ”€â”€ CONTRIBUTING.md
â”œâ”€â”€ debug.txt
â”œâ”€â”€ index.html
â”œâ”€â”€ index.tsx
â”œâ”€â”€ metadata.json
â”œâ”€â”€ package.json
â”œâ”€â”€ README.md
â”œâ”€â”€ teste.ts
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ types.ts
â””â”€â”€ vite.config.ts
```

---

## ðŸ”„ MigraÃ§Ã£o Futura para Firebase Real

Para conectar com um backend Firebase real no futuro:

1.  Configure um projeto no Console do Firebase.
2.  Atualize o arquivo `services/firebase.ts` com suas credenciais reais.
3.  No `App.tsx` e outros componentes, altere as importaÃ§Ãµes de `../services/localService` para `../services/firebase`.
4.  A lÃ³gica de `onSnapshot` e `setDoc` jÃ¡ estÃ¡ compatÃ­vel com a SDK do Firebase.

---

## ðŸ“š ManutenÃ§Ã£o da DocumentaÃ§Ã£o

Este projeto segue uma polÃ­tica rigorosa de **DocumentaÃ§Ã£o Viva**.

### AtualizaÃ§Ã£o AutomÃ¡tica da Estrutura

Sempre que adicionar novos arquivos ou pastas, execute o seguinte comando para atualizar a Ã¡rvore de diretÃ³rios neste README:

```bash
npm run docs:update
```

Para mais detalhes sobre como contribuir e manter a documentaÃ§Ã£o, consulte o arquivo [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

---

## ðŸ“± InstalaÃ§Ã£o Mobile (PWA + Capacitor)

### PWA â€” Instalar direto no celular

O Flow Finance Ã© uma **Progressive Web App** totalmente instalÃ¡vel. Para instalar:

1. Abra o app no navegador mobile (Chrome/Safari)
2. Toque em **"Adicionar Ã  tela inicial"** (iOS) ou no banner de instalaÃ§Ã£o (Android)
3. O app funciona offline graÃ§as ao Service Worker

### Capacitor â€” Build nativo Android/iOS

**PrÃ©-requisitos:**
- Node.js 18+
- Android Studio (para Android)
- Xcode 14+ (para iOS, somente macOS)

**Passo a passo:**

```bash
# 1. Instalar dependÃªncias do Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# 2. Gerar o build web otimizado
npm run build

# 3. Adicionar plataformas nativas
npx cap add android
npx cap add ios

# 4. Sincronizar assets web com plataformas nativas
npx cap sync

# 5. Abrir no Android Studio
npx cap open android

# 6. Abrir no Xcode (somente macOS)
npx cap open ios
```

**Desenvolvimento com hot-reload:**

```bash
# Rodar dev server e apontar Capacitor para ele
npm run dev
# Em outro terminal (edite capacitor.config.ts com o IP local):
npx cap run android --livereload --external
```

**ConfiguraÃ§Ã£o:** edite `capacitor.config.ts` na raiz do projeto para ajustar `appId`, `appName` e opÃ§Ãµes de plugins nativos (SplashScreen, StatusBar, Keyboard).

### Event Engine

O **Financial Event Engine** (`src/services/finance/eventEngine.ts`) conecta todos os subsistemas via eventos desacoplados:

| Evento | Dispara quando |
|--------|---------------|
| `transaction_created` | UsuÃ¡rio adiciona uma transaÃ§Ã£o |
| `recurring_generated` | RecorrÃªncia Ã© expandida |
| `insight_generated` | Novo insight financeiro detectado |
| `risk_detected` | Risco financeiro identificado |
| `autopilot_action` | Autopilot gera uma aÃ§Ã£o |
| `goal_created` | Meta financeira criada |

Para emitir um evento customizado:

```typescript
import { FinancialEventEmitter } from './services/finance/eventEngine';

FinancialEventEmitter.transactionCreated(transaction);
```

Para escutar eventos:

```typescript
import { subscribeToEvent } from './services/finance/eventEngine';

const unsubscribe = subscribeToEvent('risk_detected', (event) => {
  console.log('Risco detectado:', event.payload);
});

// Cleanup:
unsubscribe();
```

---

## Status Tecnico Atual (2026-03-16)

### Entregas concluidas
- Sprint 2 D1-D4 concluida
- Observability A004 concluida (logger com sink Sentry)
- Main validada com lint, testes, cobertura critica e E2E

### Motores financeiros recentes
- Financial Timeline: agregacao mensal, trend detection e anomalias
- Financial Profile Classifier: perfil, confidence, topCategories e insights acionaveis

### Evidencias de validacao
- npm run lint: OK
- npm test: 377/377
- npm run test:coverage:critical: 99.76% stmts / 98.3% branches
- npm run test:e2e: 30 passed / 35 skipped

---

## ðŸ”’ AutomaÃ§Ã£o de Qualidade e DependÃªncias

### Pre-commit hooks obrigatÃ³rios

O projeto utiliza **Husky** para garantir que todo commit sÃ³ seja aceito se passar pelo lint (`npm run lint`) e pelo type-check (`npm run type-check`).

- Para instalar os hooks apÃ³s o clone:
  ```bash
  npx husky install
  ```
- Os hooks estÃ£o em `.husky/pre-commit`.
- Se algum erro for detectado, o commit serÃ¡ bloqueado.

### AtualizaÃ§Ã£o automÃ¡tica de dependÃªncias

O repositÃ³rio utiliza **Dependabot** para monitorar e atualizar dependÃªncias do frontend (`/`) e backend (`/backend`).
Pull requests automÃ¡ticas sÃ£o abertas semanalmente para manter o projeto seguro e atualizado.

ConfiguraÃ§Ã£o: `.github/dependabot.yml`

## Monitoramento de IntegraÃ§Ãµes Externas
O sistema recomenda configurar alertas/logs para Pluggy, Stripe e Firebase. ApÃ³s cada deploy, monitore falhas, lentidÃ£o e quedas de serviÃ§o. Exemplos de boas prÃ¡ticas:
- Ativar logs detalhados de erro e sucesso
- Configurar alertas automÃ¡ticos (ex: via Sentry, Firebase Crashlytics)
- Validar respostas e tempos de integraÃ§Ã£o periodicamente


# Flow Finance - Controle de Fluxo de Caixa Inteligente

**VersÃ£o:** 0.8.0  
**Ãšltima AtualizaÃ§Ã£o:** 25 de MarÃ§o de 2026  
**Status:** Auditoria tÃ©cnica completa, cobertura crÃ­tica >98%, ver AUDIT_REPORT_v0.8.0.md

Bem-vindo ao **Flow Finance**, uma aplicaÃ§Ã£o moderna para gestÃ£o financeira pessoal e profissional, equipada com um assistente de IA (GPT-4) para facilitar o lanÃ§amento de despesas e receitas.

## ðŸš€ VisÃ£o Geral

O Flow Finance Ã© uma plataforma completa de gestÃ£o financeira com IA, desenvolvida com **React + Vite**, **Firebase** (auth/data) e **OpenAI GPT-4** (via backend proxy seguro). O projeto segue arquitetura **Clean Architecture** com separaÃ§Ã£o clara de responsabilidades.


### Principais Funcionalidades (v0.8.x)

-   **Dashboard Interativo:** VisÃ£o geral de receitas, despesas e saldo com grÃ¡ficos animados.
-   **Assistente de IA (CFO Virtual):** Consultas financeiras em linguagem natural via GPT-4.
-   **AnÃ¡lise Financeira Automatizada:** Pipeline de IA para insights, detecÃ§Ã£o de riscos, perfil financeiro, money map, previsÃ£o de cashflow e recomendaÃ§Ãµes ativas do Autopilot.
-   **GestÃ£o de TransaÃ§Ãµes:**
   - Adicione, edite, categorize e importe transaÃ§Ãµes (CSV/OFX).
   - **EdiÃ§Ã£o de categoria com sugestÃ£o automÃ¡tica de IA**: ao editar, o sistema sugere a categoria mais provÃ¡vel com base no merchant.
   - **BotÃ£o "Desfazer"**: permite restaurar a categoria anterior instantaneamente, com feedback visual.
   - **Acessibilidade e feedback visual aprimorados**: modal com foco automÃ¡tico, atalhos e feedback de sucesso.
   - **Cobertura de testes**: fluxo validado por testes unitÃ¡rios e E2E.
-   **Metas e Alertas Inteligentes:** Defina objetivos financeiros, receba alertas de overspending em tempo real por categoria, sugestÃµes de corte automÃ¡ticas (com valor sugerido) e metas automÃ¡ticas de corte, economia e reserva de emergÃªncia geradas por IA.
-   **Open Banking (Pluggy + Mock):** Fluxo real via backend protegido com fallback local para desenvolvimento.
-   **Scanner de Recibos:** OCR para extrair dados de comprovantes (Gemini Vision).
-   **Central de Apoio:** Acesso rÃ¡pido a suporte via IA, contato e documentos legais.
-   **Modo Escuro/Claro:** Interface adaptÃ¡vel Ã  sua preferÃªncia.
-   **Totalmente Responsivo:** Funciona bem em desktop e mobile (PWA pronto).

---

## ðŸ“¦ Stack TecnolÃ³gica (v0.7.x)

### Frontend
- **React 19** + **TypeScript 5.8**
- **Vite 6** (build otimizado)
- **TailwindCSS 3** (UI responsiva)
- **Firebase SDK** (Auth + Firestore)
- **Recharts** (grÃ¡ficos) + **Lucide React** (Ã­cones)
- **Capacitor** (iOS/Android deployment)

### Backend
- **Node.js 20** + **Express 4**
- **TypeScript 5.3**
- **OpenAI SDK** (GPT-4 para consultas financeiras)
- **Gemini SDK** (OCR de recibos - opcional)
- **PostgreSQL** (persistÃªncia futura opcional para Open Finance)
- **JWT** (autenticaÃ§Ã£o stateless)
- **Pino** (logging estruturado)

### Cloud & Deploy
- **Frontend:** Vercel (SPA estÃ¡tico)
- **Backend:** Vercel Serverless Functions / Railway
- **Database:** Firebase Firestore (produÃ§Ã£o)
- **Storage:** Firebase Storage (recibos)
- **Monitoring:** Sentry (error tracking)

---

## Docker Setup & Deployment

### PrÃ©-requisitos

- Docker & Docker Compose
- Node.js 18+ (para desenvolvimento local)
- Git

### ðŸš€ ExecuÃ§Ã£o com Docker

1. **Clone o repositÃ³rio:**
   ```bash
   git clone https://github.com/Gehlenn/Flow-Finance.git
   cd Flow-Finance
   ```

2. **Configure as variÃ¡veis de ambiente:**
   ```bash
   cp .env.example .env
   # Edite o .env com suas configuraÃ§Ãµes
   ```

3. **Execute com Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Acesse a aplicaÃ§Ã£o:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

### ðŸ› ï¸ Desenvolvimento Local

1. **Instale dependÃªncias:**
   ```bash
   npm install
   cd backend && npm install
   ```

2. **Configure o banco de dados:**
   ```bash
   # Com Docker
   docker run -d --name postgres-dev -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:15
   docker run -d --name redis-dev -p 6379:6379 redis:7
   ```

3. **Execute os serviÃ§os:**
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   cd backend && npm run dev
   ```

### âœ… Checkpoint de TransiÃ§Ã£o 0.5.2v

- Hardening SaaS aplicado com padronizacao de erros de permissao, limite e feature
- Validadores de entrada para transacoes e metas adicionados ao fluxo de servicos
- Observabilidade de IA ampliada com metricas de chamada, erro e latencia
- E2E do Pluggy estabilizado com skip controlado quando backend local nao estiver disponivel
- Cobertura critica validada em `99.76%` statements e `98.3%` branches no recorte protocolar
- Sprint 1 concluida: `SubscriptionRepository.update()`, memoizacao de `resolveSaaSContext`, sanitizacao de `AppError.details` e redaction no logger

> Nota de versionamento: a label documental desta transicao e `0.5.2v`, enquanto o ciclo tecnico interno de pacotes permanece na trilha `0.6.x` para compatibilidade operacional.

### ðŸ—ï¸ Build Manual

```bash
# Frontend
npm run build

# Backend
cd backend && npm run build

# Executar
npm run preview  # Frontend
cd backend && npm start  # Backend
```

---

## ðŸ› ï¸ Arquitetura SaaS - Clean Architecture

O Flow Finance foi completamente refatorado para uma arquitetura SaaS escalÃ¡vel seguindo os princÃ­pios de **Clean Architecture**, **DDD (Domain Driven Design)**, **SOLID** e **event-driven architecture**.

### Camadas da Arquitetura

```
src/
â”œâ”€â”€ domain/           # ðŸ›ï¸  Camada de DomÃ­nio (Domain Layer)
â”‚   â””â”€â”€ entities.ts   # Entidades de negÃ³cio com regras invariantes
â”œâ”€â”€ app/              # ðŸš€ Camada de AplicaÃ§Ã£o (Application Layer)
â”‚   â””â”€â”€ services.ts   # ServiÃ§os de aplicaÃ§Ã£o e coordenaÃ§Ã£o
â”œâ”€â”€ storage/          # ðŸ’¾ Camada de Infraestrutura (Infrastructure Layer)
â”‚   â””â”€â”€ StorageProvider.ts # AbstraÃ§Ã£o de persistÃªncia
â”œâ”€â”€ ai/               # ðŸ¤– MÃ³dulos de IA
â”œâ”€â”€ finance/          # ðŸ’° Engines financeiros
â”œâ”€â”€ security/         # ðŸ”’ SeguranÃ§a e integridade
â”œâ”€â”€ events/           # ðŸ“¡ Sistema de eventos
â””â”€â”€ config/           # âš™ï¸  ConfiguraÃ§Ã£o e DI
```

### PrincÃ­pios Implementados

- **ðŸ›ï¸ Clean Architecture:** SeparaÃ§Ã£o clara entre domÃ­nio, aplicaÃ§Ã£o e infraestrutura
- **ðŸ“¦ SOLID Principles:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **ðŸŽ¯ Domain Driven Design:** Entidades focadas em regras de negÃ³cio
- **ðŸ“¡ Event-Driven:** ComunicaÃ§Ã£o desacoplada via sistema de eventos
- **ðŸ”„ Dependency Injection:** InjeÃ§Ã£o de dependÃªncias para testabilidade
- **ðŸ›¡ï¸ Type Safety:** TypeScript rigoroso em todas as camadas

### ServiÃ§os de AplicaÃ§Ã£o

- **UserService:** Gerenciamento de usuÃ¡rios
- **TransactionService:** OperaÃ§Ãµes com transaÃ§Ãµes
- **AccountService:** Gerenciamento de contas
- **GoalService:** Metas financeiras
- **SimulationService:** SimulaÃ§Ãµes financeiras
- **ReportService:** RelatÃ³rios e anÃ¡lises
- **SubscriptionService:** Assinaturas recorrentes
- **BankConnectionService:** ConexÃµes bancÃ¡rias

### Provedores de Armazenamento

- **LocalStorageProvider:** Para desenvolvimento e testes locais
- **ApiStorageProvider:** Para integraÃ§Ã£o com backend API

Para detalhes profundos sobre o fluxo de dados e diagramas, consulte o arquivo [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## ðŸ“Š Monitoramento

### Sentry (Error Tracking)
Configure o DSN no `.env`:
```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Health Checks
- `/health` - Status geral do sistema
- `/api/version` - VersÃ£o da API

### Logs
```bash
# Ver logs do Docker
docker-compose logs -f

# Logs especÃ­ficos
docker-compose logs backend
docker-compose logs frontend
```

## ðŸ”’ SeguranÃ§a

### Headers de SeguranÃ§a
- Helmet.js configurado
- CORS configurado
- Rate limiting ativo
- Content Security Policy

### AutenticaÃ§Ã£o
- JWT tokens
- bcrypt para hash de senhas
- SessÃµes Redis

### Rate Limiting
- API geral: 10 req/segundo
- Auth endpoints: 5 req/minuto

## ðŸ§ª Testes

```bash
# Todos os testes
npm run test

# Com coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## ðŸ“š DocumentaÃ§Ã£o Adicional

- [Arquitetura SaaS](./SAAS_ARCHITECTURE.md)
- [Guia de Desenvolvimento](./CONTRIBUTING.md)
- [API Documentation](./backend/README.md)

---

## ðŸ“‚ Estrutura de Pastas

```text
â”œâ”€â”€ components
â”‚   â”œâ”€â”€ AIInput.tsx
â”‚   â”œâ”€â”€ Analytics.tsx
â”‚   â”œâ”€â”€ Assistant.tsx
â”‚   â”œâ”€â”€ CashFlow.tsx
â”‚   â”œâ”€â”€ Dashboard.tsx
â”‚   â”œâ”€â”€ LegalModal.tsx
â”‚   â”œâ”€â”€ Login.tsx
â”‚   â”œâ”€â”€ Logo.tsx
â”‚   â”œâ”€â”€ NamePromptModal.tsx
â”‚   â”œâ”€â”€ OpenFinance.tsx
â”‚   â”œâ”€â”€ Settings.tsx
â”‚   â”œâ”€â”€ SpendingAlerts.tsx
â”‚   â””â”€â”€ TransactionList.tsx
â”œâ”€â”€ services
â”‚   â”œâ”€â”€ firebase.ts
â”‚   â”œâ”€â”€ geminiService.ts
â”‚   â””â”€â”€ localService.ts
â”œâ”€â”€ .gitignore
â”œâ”€â”€ App.tsx
â”œâ”€â”€ ARCHITECTURE.md
â”œâ”€â”€ CONTRIBUTING.md
â”œâ”€â”€ debug.txt
â”œâ”€â”€ index.html
â”œâ”€â”€ index.tsx
â”œâ”€â”€ metadata.json
â”œâ”€â”€ package.json
â”œâ”€â”€ README.md
â”œâ”€â”€ teste.ts
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ types.ts
â””â”€â”€ vite.config.ts
```

---

## ðŸ”„ MigraÃ§Ã£o Futura para Firebase Real

Para conectar com um backend Firebase real no futuro:

1.  Configure um projeto no Console do Firebase.
2.  Atualize o arquivo `services/firebase.ts` com suas credenciais reais.
3.  No `App.tsx` e outros componentes, altere as importaÃ§Ãµes de `../services/localService` para `../services/firebase`.
4.  A lÃ³gica de `onSnapshot` e `setDoc` jÃ¡ estÃ¡ compatÃ­vel com a SDK do Firebase.

---

## ðŸ“š ManutenÃ§Ã£o da DocumentaÃ§Ã£o

Este projeto segue uma polÃ­tica rigorosa de **DocumentaÃ§Ã£o Viva**.

### AtualizaÃ§Ã£o AutomÃ¡tica da Estrutura

Sempre que adicionar novos arquivos ou pastas, execute o seguinte comando para atualizar a Ã¡rvore de diretÃ³rios neste README:

```bash
npm run docs:update
```

Para mais detalhes sobre como contribuir e manter a documentaÃ§Ã£o, consulte o arquivo [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## ðŸ“± InstalaÃ§Ã£o Mobile (PWA + Capacitor)

### PWA â€” Instalar direto no celular

O Flow Finance Ã© uma **Progressive Web App** totalmente instalÃ¡vel. Para instalar:

1. Abra o app no navegador mobile (Chrome/Safari)
2. Toque em **"Adicionar Ã  tela inicial"** (iOS) ou no banner de instalaÃ§Ã£o (Android)
3. O app funciona offline graÃ§as ao Service Worker

### Capacitor â€” Build nativo Android/iOS

**PrÃ©-requisitos:**
- Node.js 18+
- Android Studio (para Android)
- Xcode 14+ (para iOS, somente macOS)

**Passo a passo:**

```bash
# 1. Instalar dependÃªncias do Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# 2. Gerar o build web otimizado
npm run build

# 3. Adicionar plataformas nativas
npx cap add android
npx cap add ios

# 4. Sincronizar assets web com plataformas nativas
npx cap sync

# 5. Abrir no Android Studio
npx cap open android

# 6. Abrir no Xcode (somente macOS)
npx cap open ios
```

**Desenvolvimento com hot-reload:**

```bash
# Rodar dev server e apontar Capacitor para ele
npm run dev
# Em outro terminal (edite capacitor.config.ts com o IP local):
npx cap run android --livereload --external
```

**ConfiguraÃ§Ã£o:** edite `capacitor.config.ts` na raiz do projeto para ajustar `appId`, `appName` e opÃ§Ãµes de plugins nativos (SplashScreen, StatusBar, Keyboard).

### Event Engine

O **Financial Event Engine** (`src/services/finance/eventEngine.ts`) conecta todos os subsistemas via eventos desacoplados:

| Evento | Dispara quando |
|--------|---------------|
| `transaction_created` | UsuÃ¡rio adiciona uma transaÃ§Ã£o |
| `recurring_generated` | RecorrÃªncia Ã© expandida |
| `insight_generated` | Novo insight financeiro detectado |
| `risk_detected` | Risco financeiro identificado |
| `autopilot_action` | Autopilot gera uma aÃ§Ã£o |
| `goal_created` | Meta financeira criada |

Para emitir um evento customizado:

```typescript
import { FinancialEventEmitter } from './services/finance/eventEngine';

FinancialEventEmitter.transactionCreated(transaction);
```

Para escutar eventos:

```typescript
import { subscribeToEvent } from './services/finance/eventEngine';

const unsubscribe = subscribeToEvent('risk_detected', (event) => {
  console.log('Risco detectado:', event.payload);
});

// Cleanup:
unsubscribe();
```

---

## Status Tecnico Atual (2026-03-16)

### Entregas concluidas
- Sprint 2 D1-D4 concluida
- Observability A004 concluida (logger com sink Sentry)
- Main validada com lint, testes, cobertura critica e E2E

### Motores financeiros recentes
- Financial Timeline: agregacao mensal, trend detection e anomalias
- Financial Profile Classifier: perfil, confidence, topCategories e insights acionaveis

### Evidencias de validacao
- npm run lint: OK
- npm test: 377/377
- npm run test:coverage:critical: 99.76% stmts / 98.3% branches
- npm run test:e2e: 30 passed / 35 skipped

---

## ðŸ”’ AutomaÃ§Ã£o de Qualidade e DependÃªncias

### Pre-commit hooks obrigatÃ³rios

O projeto utiliza **Husky** para garantir que todo commit sÃ³ seja aceito se passar pelo lint (`npm run lint`) e pelo type-check (`npm run type-check`).

- Para instalar os hooks apÃ³s o clone:
  ```bash
  npx husky install
  ```
- Os hooks estÃ£o em `.husky/pre-commit`.
- Se algum erro for detectado, o commit serÃ¡ bloqueado.

### AtualizaÃ§Ã£o automÃ¡tica de dependÃªncias

O repositÃ³rio utiliza **Dependabot** para monitorar e atualizar dependÃªncias do frontend (`/`) e backend (`/backend`).
Pull requests automÃ¡ticas sÃ£o abertas semanalmente para manter o projeto seguro e atualizado.

ConfiguraÃ§Ã£o: `.github/dependabot.yml`


---

## Protocolo de TransiÃ§Ã£o v0.9.1 (2026-04-03)
- Ajuste da suÃ­te crÃ­tica para incluir `v091-critical-flows` e mÃ³dulos auditados de moeda/categorizaÃ§Ã£o/workspace.
- Meta mandatÃ³ria de cobertura crÃ­tica mantida em >= 98% (statements/branches/functions/lines).
- Em caso de bloqueio de registry npm no ambiente local, validar em CI com artefato de cobertura anexado.
