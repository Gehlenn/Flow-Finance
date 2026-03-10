# Flow Finance - Controle de Fluxo de Caixa Inteligente

**Versão:** 0.6.0  
**Última Atualização:** 10 de Março de 2026  
**Status:** Production-Ready ✅

Bem-vindo ao **Flow Finance**, uma aplicação moderna para gestão financeira pessoal e profissional, equipada com um assistente de IA (GPT-4) para facilitar o lançamento de despesas e receitas.

## 🚀 Visão Geral

O Flow Finance é uma plataforma completa de gestão financeira com IA, desenvolvida com **React + Vite**, **Firebase** (auth/data) e **OpenAI GPT-4** (via backend proxy seguro). O projeto segue arquitetura **Clean Architecture** com separação clara de responsabilidades.

### Principais Funcionalidades

-   **Dashboard Interativo:** Visão geral de receitas, despesas e saldo com gráficos animados.
-   **Assistente de IA (CFO Virtual):** Consultas financeiras em linguagem natural via GPT-4.
-   **Análise Financeira Automatizada:** Pipeline de IA para insights, detecção de riscos, perfil financeiro, money map e previsão de cashflow.
-   **Gestão de Transações:** Adicione, edite, categorize e importe transações (CSV/OFX).
-   **Metas e Alertas:** Defina objetivos financeiros e receba alertas inteligentes de gastos.
-   **Open Banking (Mock):** Simulação de sincronização bancária automática.
-   **Scanner de Recibos:** OCR para extrair dados de comprovantes (Gemini Vision).
-   **Central de Apoio:** Acesso rápido a suporte via IA, contato e documentos legais.
-   **Modo Escuro/Claro:** Interface adaptável à sua preferência.
-   **Totalmente Responsivo:** Funciona bem em desktop e mobile (PWA pronto).

---

## 📦 Stack Tecnológica (v0.6.0)

### Frontend
- **React 18** + **TypeScript 5.3**
- **Vite 6** (build otimizado)
- **TailwindCSS 3** (UI responsiva)
- **Firebase SDK** (Auth + Firestore)
- **Recharts** (gráficos) + **Lucide React** (ícones)
- **Capacitor** (iOS/Android deployment)

### Backend
- **Node.js 20** + **Express 5**
- **TypeScript 5.3**
- **OpenAI SDK** (GPT-4 para consultas financeiras)
- **Gemini SDK** (OCR de recibos - opcional)
- **PostgreSQL** (dados relacionais - opcional)
- **JWT** (autenticação stateless)
- **Pino** (logging estruturado)

### Cloud & Deploy
- **Frontend:** Vercel (SPA estático)
- **Backend:** Vercel Serverless Functions / Railway
- **Database:** Firebase Firestore (produção)
- **Storage:** Firebase Storage (recibos)
- **Monitoring:** Sentry (error tracking)

---

## � Docker Setup & Deployment

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

## �🛠️ Arquitetura SaaS - Clean Architecture

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

## � Deployment

### Plataformas Suportadas

O Flow Finance está pronto para deploy nas seguintes plataformas:

#### Railway
```bash
# Instale Railway CLI
npm install -g @railway/cli

# Login e deploy
railway login
railway deploy
```

#### Render
- Conecte o repositório GitHub
- Configure os serviços (Web Service + PostgreSQL + Redis)
- Defina as variáveis de ambiente

#### AWS
```bash
# ECS + Fargate
aws ecs create-cluster --cluster-name flow-finance
aws ecs create-service --cluster flow-finance --service-name flow-finance-service --task-definition flow-finance-task
```

#### DigitalOcean App Platform
- Conecte o repositório
- Configure os componentes (Frontend + API + Database)
- Defina variáveis de ambiente

### 📋 Checklist de Produção

- [ ] Variáveis de ambiente configuradas
- [ ] Banco PostgreSQL provisionado
- [ ] Redis provisionado
- [ ] Chaves API configuradas (Gemini, Sentry)
- [ ] Domínio configurado
- [ ] SSL/TLS habilitado
- [ ] Backups configurados
- [ ] Monitoring ativo

### 🔧 Configuração de Produção

#### PostgreSQL
```sql
-- Conectar ao banco
psql postgresql://user:password@host:5432/database

-- Executar migrations
\i docker/postgres/init.sql
```

#### Redis
```bash
# Verificar conexão
redis-cli -h your-redis-host ping
```

#### Cloud Storage
Configure AWS S3 ou Cloudflare R2 no `.env`:
```env
CLOUD_STORAGE_PROVIDER=aws-s3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket
```

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

## �📦 Como Rodar o Projeto

Siga os passos abaixo para executar o aplicativo em seu ambiente local:

### Pré-requisitos

-   Node.js (versão 18 ou superior recomendada)
-   NPM ou Yarn

### Instalação e Execução

1.  **Instale as dependências:**
    ```bash
    npm install
    ```

2.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

3.  **Acesse o aplicativo:**
    O terminal mostrará o endereço local, geralmente `http://localhost:3000`.

---

## 🧪 Como Testar

O aplicativo possui um sistema de autenticação simulado para facilitar os testes:

1.  **Acesso Rápido (Modo Demo):**
    -   Na tela de login, clique no botão **"Acesso Rápido (Teste)"** ou **"Iniciar Modo Demo"**.
    -   Isso fará login automaticamente com um usuário de teste e dados de exemplo.

2.  **Criar Nova Conta:**
    -   Clique em "Novo por aqui? Cadastre-se".
    -   Preencha qualquer nome, e-mail e senha (mínimo 6 caracteres).
    -   O sistema criará um usuário local e persistirá a sessão.

3.  **Testar Persistência:**
    -   Adicione uma transação ou altere o tema.
    -   Recarregue a página (F5).
    -   Seus dados permanecerão salvos (até que você limpe o cache do navegador).

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
