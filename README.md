<<<<<<< ours
<<<<<<< ours
﻿## Monitoramento de Integrações Externas
O sistema recomenda configurar alertas/logs para Pluggy, Stripe e Firebase. Após cada deploy, monitore falhas, lentidão e quedas de serviço. Exemplos de boas práticas:
- Ativar logs detalhados de erro e sucesso
- Configurar alertas automáticos (ex: via Sentry, Firebase Crashlytics)
- Validar respostas e tempos de integração periodicamente


# Flow Finance - Controle de Fluxo de Caixa Inteligente

**Versão:** 0.9.1v  
**Última Atualização:** 2 de Abril de 2026  
**Status:** Transicao 0.9.1v validada end-to-end com lint, testes, cobertura critica >= 98% e E2E verde

Bem-vindo ao **Flow Finance**, uma aplicação moderna para gestão financeira pessoal e profissional, equipada com assistente de IA para facilitar o lançamento de despesas e receitas.

## 🚀 Visão Geral

O Flow Finance é uma plataforma completa de gestão financeira com IA, desenvolvida com **React + Vite**, **Firebase** (auth/data) e backend com **OpenAI GPT-4 ou Gemini** (configurável, via proxy seguro). O projeto segue arquitetura **Clean Architecture** com separação clara de responsabilidades.

## ✅ Checkpoint de Transição 0.9.1v

- Auditoria sistêmica executada com foco em OWASP, fluxos críticos e prontidão SaaS.
- Validações executadas:
   - `npm run lint` (aprovado)
   - `npm test` (aprovado)
   - `npm run test:coverage:critical` (aprovado com 99.70% statements e 98.28% branches no recorte critico)
   - `npm run test:e2e` (aprovado: 28 passed / 57 skipped)
- Riscos prioritários identificados: sanitização de `description`, robustez de segredo JWT em produção, quota obrigatória nos endpoints de IA, conflitos de sincronização e duplicação de lógica de categorização.


### Principais Funcionalidades (v0.8.x)

-   **Dashboard Interativo:** Visão geral de receitas, despesas e saldo com gráficos animados.
-   **Assistente de IA (CFO Virtual):** Consultas financeiras em linguagem natural via backend com OpenAI/Gemini.
-   **Análise Financeira Automatizada:** Pipeline de IA para insights, detecção de riscos, perfil financeiro, money map, previsão de cashflow e recomendações ativas do Autopilot.
-   **Gestão de Transações:**
   - Adicione, edite, categorize e importe transações (CSV/OFX).
   - **Edição de categoria com sugestão automática de IA**: ao editar, o sistema sugere a categoria mais provável com base no merchant.
   - **Botão "Desfazer"**: permite restaurar a categoria anterior instantaneamente, com feedback visual.
   - **Acessibilidade e feedback visual aprimorados**: modal com foco automático, atalhos e feedback de sucesso.
   - **Cobertura de testes**: fluxo validado por testes unitários e E2E.
-   **Metas e Alertas Inteligentes:** Defina objetivos financeiros, receba alertas de overspending em tempo real por categoria, sugestões de corte automáticas (com valor sugerido) e metas automáticas de corte, economia e reserva de emergência geradas por IA.
-   **Open Banking (Pluggy + Mock):** Fluxo real via backend protegido com fallback local para desenvolvimento.
-   **Scanner de Recibos:** OCR para extrair dados de comprovantes (Tesseract.js com fallback e integração opcional por IA no backend).
-   **Central de Apoio:** Acesso rápido a suporte via IA, contato e documentos legais.
-   **Modo Escuro/Claro:** Interface adaptável à sua preferência.
-   **Totalmente Responsivo:** Funciona bem em desktop e mobile (PWA pronto).

---

## 📦 Stack Tecnológica (v0.7.x)

### Frontend
- **React 19** + **TypeScript 5.8**
- **Vite 6** (build otimizado)
- **TailwindCSS 3** (UI responsiva)
- **Firebase SDK** (Auth + Firestore)
- **Recharts** (gráficos) + **Lucide React** (ícones)
- **Capacitor** (iOS/Android deployment)

### Backend
- **Node.js 20** + **Express 4**
- **TypeScript 5.3**
- **OpenAI SDK** e **Gemini SDK** (fallback e configuração por ambiente)
- **PostgreSQL** (persistência futura opcional para Open Finance)
- **JWT** (autenticação stateless)
- **Pino** (logging estruturado)

---

## 🧰 Development Utilities

```bash
# Limpeza de dados (Firestore + backend/data)
npm run db:reset

# Segurança: varredura de secrets em arquivos versionados
npm run security:scan-secrets

# Qualidade
npm run lint
npm test
npm run test:coverage:critical
npm run test:e2e
```

### Cloud & Deploy
- **Frontend:** Vercel (SPA estático)
- **Backend:** Vercel Serverless Functions / Railway
- **Database:** Firebase Firestore (produção)
- **Storage:** Firebase Storage (recibos)
- **Monitoring:** Sentry (error tracking)

### AI CFO - Segurança Operacional
- Endpoint: `POST /api/ai/cfo` via backend proxy seguro.
- Proteções ativas: autenticação JWT, contexto de workspace, rate limit por usuário e quota de uso (`aiQueries`).
- Payload validado em schema (limites de tamanho para `question/context` e `intent` restrito).
- Provider de IA configurável por ambiente: OpenAI com fallback para Gemini.
- Resposta sempre consultiva, sem garantia financeira absoluta e sem inferência fora do contexto enviado.

---

## Docker Setup & Deployment

### Pré-requisitos

- Docker & Docker Compose
- Node.js 18+ (para desenvolvimento local)
- Git

### 🚀 Execução com Docker

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Gehlenn/Flow-Finance.git
   cd Flow-Finance
   ```

2. **Configure as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   # Edite o .env com suas configurações
   ```

3. **Execute com Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Acesse a aplicação:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

### 🛠️ Desenvolvimento Local

1. **Instale dependências:**
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

3. **Execute os serviços:**
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   cd backend && npm run dev
   ```

### ✅ Checkpoint de Transição 0.5.2v

- Hardening SaaS aplicado com padronizacao de erros de permissao, limite e feature
- Validadores de entrada para transacoes e metas adicionados ao fluxo de servicos
- Observabilidade de IA ampliada com metricas de chamada, erro e latencia
- E2E do Pluggy estabilizado com skip controlado quando backend local nao estiver disponivel
- Cobertura critica validada em `99.76%` statements e `98.3%` branches no recorte protocolar
- Sprint 1 concluida: `SubscriptionRepository.update()`, memoizacao de `resolveSaaSContext`, sanitizacao de `AppError.details` e redaction no logger

> Nota de versionamento: a label documental desta transicao e `0.5.2v`, enquanto o ciclo tecnico interno de pacotes permanece na trilha `0.6.x` para compatibilidade operacional.

### 🏗️ Build Manual

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

## 🛠️ Arquitetura SaaS - Clean Architecture

O Flow Finance foi completamente refatorado para uma arquitetura SaaS escalável seguindo os princípios de **Clean Architecture**, **DDD (Domain Driven Design)**, **SOLID** e **event-driven architecture**.

### Camadas da Arquitetura

```
src/
├── domain/           # 🏛️  Camada de Domínio (Domain Layer)
│   └── entities.ts   # Entidades de negócio com regras invariantes
├── app/              # 🚀 Camada de Aplicação (Application Layer)
│   └── services.ts   # Serviços de aplicação e coordenação
├── storage/          # 💾 Camada de Infraestrutura (Infrastructure Layer)
│   └── StorageProvider.ts # Abstração de persistência
├── ai/               # 🤖 Módulos de IA
├── finance/          # 💰 Engines financeiros
├── security/         # 🔒 Segurança e integridade
├── events/           # 📡 Sistema de eventos
└── config/           # ⚙️  Configuração e DI
```

### Princípios Implementados

- **🏛️ Clean Architecture:** Separação clara entre domínio, aplicação e infraestrutura
- **📦 SOLID Principles:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **🎯 Domain Driven Design:** Entidades focadas em regras de negócio
- **📡 Event-Driven:** Comunicação desacoplada via sistema de eventos
- **🔄 Dependency Injection:** Injeção de dependências para testabilidade
- **🛡️ Type Safety:** TypeScript rigoroso em todas as camadas

### Serviços de Aplicação

- **UserService:** Gerenciamento de usuários
- **TransactionService:** Operações com transações
- **AccountService:** Gerenciamento de contas
- **GoalService:** Metas financeiras
- **SimulationService:** Simulações financeiras
- **ReportService:** Relatórios e análises
- **SubscriptionService:** Assinaturas recorrentes
- **BankConnectionService:** Conexões bancárias

### Provedores de Armazenamento

- **LocalStorageProvider:** Para desenvolvimento e testes locais
- **ApiStorageProvider:** Para integração com backend API

Para detalhes profundos sobre o fluxo de dados e diagramas, consulte o arquivo [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 📊 Monitoramento

### Sentry (Error Tracking)
Configure o DSN no `.env`:
```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Health Checks
- `/health` - Status geral do sistema
- `/api/version` - Versão da API

### Logs
```bash
# Ver logs do Docker
docker-compose logs -f

# Logs específicos
docker-compose logs backend
docker-compose logs frontend
```

## 🔒 Segurança

### Headers de Segurança
- Helmet.js configurado
- CORS configurado
- Rate limiting ativo
- Content Security Policy

### Autenticação
- JWT tokens
- bcrypt para hash de senhas
- Sessões Redis

### Rate Limiting
- API geral: 10 req/segundo
- Auth endpoints: 5 req/minuto

## 🧪 Testes

```bash
# Todos os testes
npm run test

# Com coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## 📚 Documentação Adicional

- [Arquitetura SaaS](./docs/SAAS_ARCHITECTURE.md)
- [Guia de Desenvolvimento](./docs/CONTRIBUTING.md)
- [API Documentation](./backend/README.md)
- [Archive de Versoes Anteriores](./docs/archive/README.md)

---

## 📂 Estrutura de Pastas

```text
├── components
│   ├── AIInput.tsx
│   ├── Analytics.tsx
│   ├── Assistant.tsx
│   ├── CashFlow.tsx
│   ├── Dashboard.tsx
│   ├── LegalModal.tsx
│   ├── Login.tsx
│   ├── Logo.tsx
│   ├── NamePromptModal.tsx
│   ├── OpenFinance.tsx
│   ├── Settings.tsx
│   ├── SpendingAlerts.tsx
│   └── TransactionList.tsx
├── services
│   ├── firebase.ts
│   ├── geminiService.ts
│   └── localService.ts
├── .gitignore
├── App.tsx
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── debug.txt
├── index.html
├── index.tsx
├── metadata.json
├── package.json
├── README.md
├── teste.ts
├── tsconfig.json
├── types.ts
└── vite.config.ts
```

---

## 🔄 Migração Futura para Firebase Real

Para conectar com um backend Firebase real no futuro:

1.  Configure um projeto no Console do Firebase.
2.  Atualize o arquivo `services/firebase.ts` com suas credenciais reais.
3.  No `App.tsx` e outros componentes, altere as importações de `../services/localService` para `../services/firebase`.
4.  A lógica de `onSnapshot` e `setDoc` já está compatível com a SDK do Firebase.

---

## 📚 Manutenção da Documentação

Este projeto segue uma política rigorosa de **Documentação Viva**.

### Atualização Automática da Estrutura

Sempre que adicionar novos arquivos ou pastas, execute o seguinte comando para atualizar a árvore de diretórios neste README:

```bash
npm run docs:update
```

Para mais detalhes sobre como contribuir e manter a documentação, consulte o arquivo [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

---

## 📱 Instalação Mobile (PWA + Capacitor)

### PWA — Instalar direto no celular

O Flow Finance é uma **Progressive Web App** totalmente instalável. Para instalar:

1. Abra o app no navegador mobile (Chrome/Safari)
2. Toque em **"Adicionar à tela inicial"** (iOS) ou no banner de instalação (Android)
3. O app funciona offline graças ao Service Worker

### Capacitor — Build nativo Android/iOS

**Pré-requisitos:**
- Node.js 18+
- Android Studio (para Android)
- Xcode 14+ (para iOS, somente macOS)

**Passo a passo:**

```bash
# 1. Instalar dependências do Capacitor
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

**Configuração:** edite `capacitor.config.ts` na raiz do projeto para ajustar `appId`, `appName` e opções de plugins nativos (SplashScreen, StatusBar, Keyboard).

### Event Engine

O **Financial Event Engine** (`src/services/finance/eventEngine.ts`) conecta todos os subsistemas via eventos desacoplados:

| Evento | Dispara quando |
|--------|---------------|
| `transaction_created` | Usuário adiciona uma transação |
| `recurring_generated` | Recorrência é expandida |
| `insight_generated` | Novo insight financeiro detectado |
| `risk_detected` | Risco financeiro identificado |
| `autopilot_action` | Autopilot gera uma ação |
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

## 🔒 Automação de Qualidade e Dependências

### Pre-commit hooks obrigatórios

O projeto utiliza **Husky** para garantir que todo commit só seja aceito se passar pelo lint (`npm run lint`) e pelo type-check (`npm run type-check`).

- Para instalar os hooks após o clone:
  ```bash
  npx husky install
  ```
- Os hooks estão em `.husky/pre-commit`.
- Se algum erro for detectado, o commit será bloqueado.

### Atualização automática de dependências

O repositório utiliza **Dependabot** para monitorar e atualizar dependências do frontend (`/`) e backend (`/backend`).
Pull requests automáticas são abertas semanalmente para manter o projeto seguro e atualizado.

Configuração: `.github/dependabot.yml`

=======
=======
>>>>>>> theirs
## Monitoramento de Integrações Externas
O sistema recomenda configurar alertas/logs para Pluggy, Stripe e Firebase. Após cada deploy, monitore falhas, lentidão e quedas de serviço. Exemplos de boas práticas:
- Ativar logs detalhados de erro e sucesso
- Configurar alertas automáticos (ex: via Sentry, Firebase Crashlytics)
- Validar respostas e tempos de integração periodicamente


# Flow Finance - Controle de Fluxo de Caixa Inteligente

**Versão:** 0.8.0  
**Última Atualização:** 25 de Março de 2026  
**Status:** Auditoria técnica completa, cobertura crítica >98%, ver AUDIT_REPORT_v0.8.0.md

Bem-vindo ao **Flow Finance**, uma aplicação moderna para gestão financeira pessoal e profissional, equipada com um assistente de IA (GPT-4) para facilitar o lançamento de despesas e receitas.

## 🚀 Visão Geral

O Flow Finance é uma plataforma completa de gestão financeira com IA, desenvolvida com **React + Vite**, **Firebase** (auth/data) e **OpenAI GPT-4** (via backend proxy seguro). O projeto segue arquitetura **Clean Architecture** com separação clara de responsabilidades.


### Principais Funcionalidades (v0.8.x)

-   **Dashboard Interativo:** Visão geral de receitas, despesas e saldo com gráficos animados.
-   **Assistente de IA (CFO Virtual):** Consultas financeiras em linguagem natural via GPT-4.
-   **Análise Financeira Automatizada:** Pipeline de IA para insights, detecção de riscos, perfil financeiro, money map, previsão de cashflow e recomendações ativas do Autopilot.
-   **Gestão de Transações:**
   - Adicione, edite, categorize e importe transações (CSV/OFX).
   - **Edição de categoria com sugestão automática de IA**: ao editar, o sistema sugere a categoria mais provável com base no merchant.
   - **Botão "Desfazer"**: permite restaurar a categoria anterior instantaneamente, com feedback visual.
   - **Acessibilidade e feedback visual aprimorados**: modal com foco automático, atalhos e feedback de sucesso.
   - **Cobertura de testes**: fluxo validado por testes unitários e E2E.
-   **Metas e Alertas Inteligentes:** Defina objetivos financeiros, receba alertas de overspending em tempo real por categoria, sugestões de corte automáticas (com valor sugerido) e metas automáticas de corte, economia e reserva de emergência geradas por IA.
-   **Open Banking (Pluggy + Mock):** Fluxo real via backend protegido com fallback local para desenvolvimento.
-   **Scanner de Recibos:** OCR para extrair dados de comprovantes (Gemini Vision).
-   **Central de Apoio:** Acesso rápido a suporte via IA, contato e documentos legais.
-   **Modo Escuro/Claro:** Interface adaptável à sua preferência.
-   **Totalmente Responsivo:** Funciona bem em desktop e mobile (PWA pronto).

---

## 📦 Stack Tecnológica (v0.7.x)

### Frontend
- **React 19** + **TypeScript 5.8**
- **Vite 6** (build otimizado)
- **TailwindCSS 3** (UI responsiva)
- **Firebase SDK** (Auth + Firestore)
- **Recharts** (gráficos) + **Lucide React** (ícones)
- **Capacitor** (iOS/Android deployment)

### Backend
- **Node.js 20** + **Express 4**
- **TypeScript 5.3**
- **OpenAI SDK** (GPT-4 para consultas financeiras)
- **Gemini SDK** (OCR de recibos - opcional)
- **PostgreSQL** (persistência futura opcional para Open Finance)
- **JWT** (autenticação stateless)
- **Pino** (logging estruturado)

### Cloud & Deploy
- **Frontend:** Vercel (SPA estático)
- **Backend:** Vercel Serverless Functions / Railway
- **Database:** Firebase Firestore (produção)
- **Storage:** Firebase Storage (recibos)
- **Monitoring:** Sentry (error tracking)

---

## Docker Setup & Deployment

### Pré-requisitos

- Docker & Docker Compose
- Node.js 18+ (para desenvolvimento local)
- Git

### 🚀 Execução com Docker

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Gehlenn/Flow-Finance.git
   cd Flow-Finance
   ```

2. **Configure as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   # Edite o .env com suas configurações
   ```

3. **Execute com Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Acesse a aplicação:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

### 🛠️ Desenvolvimento Local

1. **Instale dependências:**
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

3. **Execute os serviços:**
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   cd backend && npm run dev
   ```

### ✅ Checkpoint de Transição 0.5.2v

- Hardening SaaS aplicado com padronizacao de erros de permissao, limite e feature
- Validadores de entrada para transacoes e metas adicionados ao fluxo de servicos
- Observabilidade de IA ampliada com metricas de chamada, erro e latencia
- E2E do Pluggy estabilizado com skip controlado quando backend local nao estiver disponivel
- Cobertura critica validada em `99.76%` statements e `98.3%` branches no recorte protocolar
- Sprint 1 concluida: `SubscriptionRepository.update()`, memoizacao de `resolveSaaSContext`, sanitizacao de `AppError.details` e redaction no logger

> Nota de versionamento: a label documental desta transicao e `0.5.2v`, enquanto o ciclo tecnico interno de pacotes permanece na trilha `0.6.x` para compatibilidade operacional.

### 🏗️ Build Manual

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

## 🛠️ Arquitetura SaaS - Clean Architecture

O Flow Finance foi completamente refatorado para uma arquitetura SaaS escalável seguindo os princípios de **Clean Architecture**, **DDD (Domain Driven Design)**, **SOLID** e **event-driven architecture**.

### Camadas da Arquitetura

```
src/
├── domain/           # 🏛️  Camada de Domínio (Domain Layer)
│   └── entities.ts   # Entidades de negócio com regras invariantes
├── app/              # 🚀 Camada de Aplicação (Application Layer)
│   └── services.ts   # Serviços de aplicação e coordenação
├── storage/          # 💾 Camada de Infraestrutura (Infrastructure Layer)
│   └── StorageProvider.ts # Abstração de persistência
├── ai/               # 🤖 Módulos de IA
├── finance/          # 💰 Engines financeiros
├── security/         # 🔒 Segurança e integridade
├── events/           # 📡 Sistema de eventos
└── config/           # ⚙️  Configuração e DI
```

### Princípios Implementados

- **🏛️ Clean Architecture:** Separação clara entre domínio, aplicação e infraestrutura
- **📦 SOLID Principles:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **🎯 Domain Driven Design:** Entidades focadas em regras de negócio
- **📡 Event-Driven:** Comunicação desacoplada via sistema de eventos
- **🔄 Dependency Injection:** Injeção de dependências para testabilidade
- **🛡️ Type Safety:** TypeScript rigoroso em todas as camadas

### Serviços de Aplicação

- **UserService:** Gerenciamento de usuários
- **TransactionService:** Operações com transações
- **AccountService:** Gerenciamento de contas
- **GoalService:** Metas financeiras
- **SimulationService:** Simulações financeiras
- **ReportService:** Relatórios e análises
- **SubscriptionService:** Assinaturas recorrentes
- **BankConnectionService:** Conexões bancárias

### Provedores de Armazenamento

- **LocalStorageProvider:** Para desenvolvimento e testes locais
- **ApiStorageProvider:** Para integração com backend API

Para detalhes profundos sobre o fluxo de dados e diagramas, consulte o arquivo [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 📊 Monitoramento

### Sentry (Error Tracking)
Configure o DSN no `.env`:
```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Health Checks
- `/health` - Status geral do sistema
- `/api/version` - Versão da API

### Logs
```bash
# Ver logs do Docker
docker-compose logs -f

# Logs específicos
docker-compose logs backend
docker-compose logs frontend
```

## 🔒 Segurança

### Headers de Segurança
- Helmet.js configurado
- CORS configurado
- Rate limiting ativo
- Content Security Policy

### Autenticação
- JWT tokens
- bcrypt para hash de senhas
- Sessões Redis

### Rate Limiting
- API geral: 10 req/segundo
- Auth endpoints: 5 req/minuto

## 🧪 Testes

```bash
# Todos os testes
npm run test

# Com coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## 📚 Documentação Adicional

- [Arquitetura SaaS](./SAAS_ARCHITECTURE.md)
- [Guia de Desenvolvimento](./CONTRIBUTING.md)
- [API Documentation](./backend/README.md)

---

## 📂 Estrutura de Pastas

```text
├── components
│   ├── AIInput.tsx
│   ├── Analytics.tsx
│   ├── Assistant.tsx
│   ├── CashFlow.tsx
│   ├── Dashboard.tsx
│   ├── LegalModal.tsx
│   ├── Login.tsx
│   ├── Logo.tsx
│   ├── NamePromptModal.tsx
│   ├── OpenFinance.tsx
│   ├── Settings.tsx
│   ├── SpendingAlerts.tsx
│   └── TransactionList.tsx
├── services
│   ├── firebase.ts
│   ├── geminiService.ts
│   └── localService.ts
├── .gitignore
├── App.tsx
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── debug.txt
├── index.html
├── index.tsx
├── metadata.json
├── package.json
├── README.md
├── teste.ts
├── tsconfig.json
├── types.ts
└── vite.config.ts
```

---

## 🔄 Migração Futura para Firebase Real

Para conectar com um backend Firebase real no futuro:

1.  Configure um projeto no Console do Firebase.
2.  Atualize o arquivo `services/firebase.ts` com suas credenciais reais.
3.  No `App.tsx` e outros componentes, altere as importações de `../services/localService` para `../services/firebase`.
4.  A lógica de `onSnapshot` e `setDoc` já está compatível com a SDK do Firebase.

---

## 📚 Manutenção da Documentação

Este projeto segue uma política rigorosa de **Documentação Viva**.

### Atualização Automática da Estrutura

Sempre que adicionar novos arquivos ou pastas, execute o seguinte comando para atualizar a árvore de diretórios neste README:

```bash
npm run docs:update
```

Para mais detalhes sobre como contribuir e manter a documentação, consulte o arquivo [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 📱 Instalação Mobile (PWA + Capacitor)

### PWA — Instalar direto no celular

O Flow Finance é uma **Progressive Web App** totalmente instalável. Para instalar:

1. Abra o app no navegador mobile (Chrome/Safari)
2. Toque em **"Adicionar à tela inicial"** (iOS) ou no banner de instalação (Android)
3. O app funciona offline graças ao Service Worker

### Capacitor — Build nativo Android/iOS

**Pré-requisitos:**
- Node.js 18+
- Android Studio (para Android)
- Xcode 14+ (para iOS, somente macOS)

**Passo a passo:**

```bash
# 1. Instalar dependências do Capacitor
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

**Configuração:** edite `capacitor.config.ts` na raiz do projeto para ajustar `appId`, `appName` e opções de plugins nativos (SplashScreen, StatusBar, Keyboard).

### Event Engine

O **Financial Event Engine** (`src/services/finance/eventEngine.ts`) conecta todos os subsistemas via eventos desacoplados:

| Evento | Dispara quando |
|--------|---------------|
| `transaction_created` | Usuário adiciona uma transação |
| `recurring_generated` | Recorrência é expandida |
| `insight_generated` | Novo insight financeiro detectado |
| `risk_detected` | Risco financeiro identificado |
| `autopilot_action` | Autopilot gera uma ação |
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

## 🔒 Automação de Qualidade e Dependências

### Pre-commit hooks obrigatórios

O projeto utiliza **Husky** para garantir que todo commit só seja aceito se passar pelo lint (`npm run lint`) e pelo type-check (`npm run type-check`).

- Para instalar os hooks após o clone:
  ```bash
  npx husky install
  ```
- Os hooks estão em `.husky/pre-commit`.
- Se algum erro for detectado, o commit será bloqueado.

### Atualização automática de dependências

O repositório utiliza **Dependabot** para monitorar e atualizar dependências do frontend (`/`) e backend (`/backend`).
Pull requests automáticas são abertas semanalmente para manter o projeto seguro e atualizado.

Configuração: `.github/dependabot.yml`


---

## Protocolo de Transição v0.9.1 (2026-04-03)
- Ajuste da suíte crítica para incluir `v091-critical-flows` e módulos auditados de moeda/categorização/workspace.
- Meta mandatória de cobertura crítica mantida em >= 98% (statements/branches/functions/lines).
- Em caso de bloqueio de registry npm no ambiente local, validar em CI com artefato de cobertura anexado.
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
