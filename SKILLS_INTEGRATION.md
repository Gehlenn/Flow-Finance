# Skills Integration - Flow Finance

Integração de skills Tier 1 otimizados para o ciclo de release e operação contínua do Flow Finance.

## 🎯 Tier 1 Skills Instalados

### 1. GSD (Get Shit Done)
**Local:** `.agents/skills/gsd/SKILL.md`  
**Domínio:** Release automation, auditoria de código, engenharia de testes, documentação

#### Usar para:
- Iniciar ciclo de release: `/gsd-do release v0.9.1`
- Auditoria de código: `/gsd-audit-fix`
- Adicionar testes: `/gsd-add-tests`
- Validação de cobertura: `npm run test:coverage:critical`
- Ship com PR: `/gsd-ship`

#### Protocolo Flow Finance + GSD
```
1. /gsd-do "auditoria completa v0.9.1"
   ├─ Código de negócio
   ├─ Segurança financeira (cálculos, conversão, persistência)
   ├─ Performance (Core Web Vitals)
   └─ UX/UI consistency

2. /gsd-add-tests
   ├─ Cobertura crítica 98% obrigatória
   ├─ Caixa e saldo
   ├─ Transações e categorização IA
   ├─ Conversão de moeda
   └─ Fluxo de autenticação

3. /gsd-docs-update
   ├─ README.md (stack, setup, live URL)
   ├─ CHANGELOG.md (mudanças técnicas)
   ├─ BUGLOG.md (format: [ID] | [Desc] | [Root] | [Fix] | [v])
   └─ ROADMAP (próximos steps + visão SaaS)

4. /gsd-ship
   └─ Cria PR, merge, push

5. /land-and-deploy
   └─ Canary checks, monitoramento pós-deploy
```

---

### 2. Gstack
**Local:** `.agents/skills/gstack/SKILL.md`  
**Domínio:** QA automation, performance monitoring, deployment validation

#### Usar para:
- QA antes de ship: `/qa` (teste+fix) ou `/qa-only` (relatório)
- Performance baseline: `/benchmark`
- Canary pós-deploy: `/canary`
- Teste E2E crítico: `/browse [URL]` + test
- Testes autenticados: `/setup-browser-cookies`

#### Critérios Flow Finance
```
Health Checks:
 ✅ Lighthouse score > 90 (Web)
 ✅ Core Web Vitals: green
 ✅ Sem console errors críticos
 ✅ Fluxo financeiro E2E funcional
 ✅ Autenticação + transações + cálculos
```

#### Workflow
```
Pré-Ship:
  /qa-only → revisar relatório
  /qa → corrige automaticamente

Pós-Deploy:
  /benchmark → compara com baseline
  /canary → monitora por 5 min
```

---

### 3. UI/UX Pro Max
**Local:** `.agents/skills/ui-ux-pro-max/SKILL.md`  
**Domínio:** Design audit, simplificação, hierarchy, consistency

#### Usar para:
- Auditoria visual: `/design-review` (live site)
- Exploração de designs: `/design-shotgun` (variantes)
- Simplificação de navegação: refine mockups
- Ocultação Open Finance/Pluggy: component audit
- Microcopy e tone: copy consistency check

#### Prioridades Flow Finance
```
Next Wave (v0.9+):
 1. Remover/ocultar Open Finance da UI principal
 2. Remover/ocultar Pluggy do fluxo de banco
 3. Simplificar navegação: Caixa → Transações → Receitas → Assistente → Config
 4. Dashboard refocusado em saldo, entradas/saídas
 5. Assistente como recurso consultivo (não autonomia)
 6. Microcopy: tom prático, trustworthy, sem promessas amplas

Design System Base:
 - Restrained composition (foco, sem clutter)
 - Visual hierarchy clara para scanning rápido
 - Cohesive patterns (cards, forms, buttons)
 - Motion: funcional, não gimmicky
```

---

## 📋 Checklist de Uso

### Antes de Release
```
□ /gsd-audit-fix → corrige bugs críticos
□ /gsd-add-tests → 98% coverage mínimo
□ /qa-only → valida saúde geral
□ npm run lint → sem warnings
□ /design-review → sem inconsistências visuais
```

### Antes de Ship
```
□ /qa → último teste+fix
□ /gsd-ship → PR + merge
```

### Pós-Deploy
```
□ /canary → monitora por 5 min
□ /benchmark → compara performance
□ Verify → dashboard, transações, cálculos vivos
```

---

## 🔧 Configuração Recomendada

### CLAUDE.md (raiz do projeto)
Adicione seção para setup-deploy:
```bash
# Deploy Config - Vercel Frontend + Vercel Backend
DEPLOY_PLATFORM=vercel
PROD_URL=https://flow-finance.vercel.app
HEALTH_CHECK=/api/health
```

### Scripts npm (package.json)
Já existem:
```json
"lint": "eslint src --fix",
"test": "vitest",
"test:coverage:critical": "vitest --coverage --include=src/critical/**",
"test:e2e": "playwright test"
```

---

## 📚 Referências
- [GSD Official](https://github.com/pimzero/get-shit-done)
- [Gstack Official](https://github.com/gstack-ai/gstack)
- [Flow Finance AGENTS.md](./AGENTS.md)
- [Flow Finance Protocol](obsidian-vault/Flow/Project%20Rules.md)

---

## 🚀 Tier 2 Skills (Automação & Memória)

### 1. n8n-MCP
**Local:** `.agents/skills/n8n-mcp/SKILL.md`  
**Status:** Planejado para v1.0  
**Quando usar:** Integração com consultório (webhooks, eventos financeiros)

#### Setup
```bash
# Instalar quando n8n instance estiver ativa
claude mcp add --scope user https://github.com/leonardsellem/n8n-mcp
```

#### Webhook Flow
```
Consultório (n8n) 
  ↓ POST event
Flow Finance API (/api/webhooks/external-events)
  ↓ Processa
Firestore (persiste receitas/lembretes)
```

#### Eventos Suportados
- `payment_received` — Recebimento de pagamento
- `receivable_reminder_updated` — Pendência atualizada
- `receivable_cleared` — Quitação total

---

### 2. claude-mem
**Local:** `.agents/skills/claude-mem/SKILL.md`  
**Status:** Pronto (usando `/memory` built-in)  
**Quando usar:** Persistir decisões, aprendizados, progresso entre sessões

#### Como Usar Agora
```bash
# Ler contexto
/memory view /memories/flow-finance-protocol.md

# Criar nota de sessão
/memory create /memories/session/task.md

# Atualizar progresso
/memory str_replace /memories/session/task.md [old] [new]

# Rastrear bug
/memory create /memories/repo/BUG-[name].md
```

#### Memory Structure
```
/memories/flow-finance-protocol.md      — Protocolos obrigatórios
/memories/session/                      — Contexto desta sessão
/memories/repo/CORS-FIX-LOG.md         — Histórico de decisões
/memories/repo/GEMINI-MODEL-*.md       — Learnings de testes
```

---

## 🔧 Tier 3 (Otimização)

### RTK (Token Optimization)
**Local:** `.agents/skills/rtk/SKILL.md`  
**Status:** Estrutura pronta (instalação opcional)

#### Quando Usar
- Diffs longos de PRs grandes (reduz 80%)
- Build logs volumosos (reduz 80-90%)
- Test output extenso (reduz 90-99%)
- Dependency lists (reduz 70-80%)

#### Como Usar
```bash
rtk git diff                # Diff compacto
rtk npm run test:critical   # Failures apenas
rtk pnpm list              # Dependency tree compacto
```

#### Instalação (Opcional)
```bash
# Windows via Chocolatey
choco install rtk

# Ou manualmente: download de https://github.com/rtk-ai/rtk/releases
```

---

### Obsidian Skills
**Status:** Planejado se documentação ficar manual  
**Quando:** Se doc generation se tornar gargalo

---

## 📊 Timeline Recomendado

| Fase | Quando | O quê |
|------|--------|-------|
| v0.9 | Agora | Tier 1 (GSD+Gstack+UI/UX) |
| v1.0 | Depois | Tier 2 (n8n-MCP + claude-mem ativo) |
| v1.1+ | Futuro | Tier 3 (RTK + Obsidian) |
