# Skills do Flow Finance - Visão Geral

## 📦 O que foi instalado

### ✅ Tier 1 (Crítico - Pronto Agora)

| Skill | Caminho Local | Função | Comandos |
|-------|---------------|--------|----------|
| **GSD** | `.agents/skills/gsd/` | Release automation, auditoria, testes | `/gsd-do`, `/gsd-audit-fix`, `/gsd-add-tests`, `/gsd-ship` |
| **Gstack** | `.agents/skills/gstack/` | QA, performance, canary | `/qa`, `/qa-only`, `/benchmark`, `/canary` |
| **UI/UX Pro Max** | `.agents/skills/ui-ux-pro-max/` | Design audit, simplificação | `/design-review`, `/design-shotgun` |

### 🟡 Tier 2 (Complementar - Estrutura Pronta)

| Skill | Caminho Local | Função | Status |
|-------|---------------|--------|--------|
| **n8n-MCP** | `.agents/skills/n8n-mcp/` | Integração consultório, webhooks | Planejado v1.0 |
| **claude-mem** | `.agents/skills/claude-mem/` | Memory persistence | `/memory` built-in já funciona |

### 📋 Tier 3 (Otimização - Futuro)

| Skill | Caminho Local | Função | Status |
|-------|---------------|--------|--------|
| **RTK** | `.agents/skills/rtk/` | Token optimization | Estrutura pronta (install opcional) |
| **Obsidian Skills** | — | Document generation | Planejado se docs ficarem manuais |

---

## 🎯 Casos de Uso por Fase

### v0.9 (Agora) - Simplificação UI
```bash
# 1. Design Audit
/design-review

# 2. Ocultação Open Finance/Pluggy
/design-shotgun "simplified dashboard without open finance"

# 3. Testes
/qa-only

# 4. Release
/gsd-do "simplify navigation and dashboard v0.9"
```

### v1.0 (Próxima) - Integração Consultório
```bash
# 1. Documentar contrato de webhook
/gsd-docs-update "n8n webhook contract"

# 2. Implementar endpoint
/gsd-do "implement /api/webhooks/external-events"

# 3. QA com eventos mock
/qa-only "test webhook payload handling"

# 4. Deploy com canary
/gsd-ship && /land-and-deploy && /canary
```

### v1.1+ (Futuro) - Otimização
```bash
# RTK reduz tokens em diffs/logs longos
rtk git log --oneline --all

# Obsidian Skills gera docs automaticamente
/obsidian-generate-docs
```

---

## 📚 Documentação Rápida

### GSD (Release Automation)
```bash
/gsd-audit-fix              # Encontra e corrige bugs
/gsd-add-tests              # Gera testes com 98% coverage
/gsd-docs-update            # Atualiza README/CHANGELOG/BUGLOG
/gsd-ship                   # Cria PR + merge
/land-and-deploy            # Deploy + canary checks
```

**Protocolo obrigatório:**
1. Auditoria
2. Testes (98% coverage mínimo)
3. Documentação
4. Ship
5. Deploy

### Gstack (QA & Performance)
```bash
/qa                         # QA completo: testa + corrige bugs
/qa-only                    # QA report apenas (sem fixes)
/benchmark                  # Performance baseline
/canary                     # Monitor pós-deploy (5 min)
```

**Critérios Flow Finance:**
- ✅ Lighthouse score > 90
- ✅ Core Web Vitals: green
- ✅ Sem console errors críticos
- ✅ Fluxo financeiro E2E funcional

### UI/UX Pro Max (Design Audit)
```bash
/design-review              # Auditoria visual (live site)
/design-shotgun             # Explore design variants
/page-cro                   # Optimize conversion pages
```

**Próximas prioridades:**
1. Remover Open Finance/Pluggy da UI
2. Simplificar navegação
3. Focar dashboard em saldo + entradas/saídas
4. Assistente como recurso consultivo

### Memory (`/memory`)
```bash
/memory view /memories/flow-finance-protocol.md    # Protocolo
/memory create /memories/session/task.md            # Nova nota
/memory str_replace [file] [old] [new]             # Atualizar
/memory view /memories/repo/                       # Histórico de bugs
```

---

## 🔗 Arquivos de Referência

- **[SKILLS_INTEGRATION.md](./SKILLS_INTEGRATION.md)** — Workflow operacional completo
- **[AGENTS.md](./AGENTS.md)** — Instruções de agente (atualizado com skills)
- **[obsidian-vault/Flow/30-Day Plan.md](./obsidian-vault/Flow/30-Day%20Plan.md)** — Roadmap

---

## ✅ Checklist Rápido

### Antes de qualquer release
```
□ /gsd-audit-fix
□ /gsd-add-tests (validate 98% coverage)
□ /qa-only
□ npm run lint
□ /design-review
```

### Antes de ship
```
□ /qa (último teste)
□ /gsd-ship (cria PR)
```

### Pós-deploy
```
□ /canary (monitora 5 min)
□ /benchmark (performance check)
□ Manual verify: dashboard, transações, cálculos
```

---

## 🚀 Próximos Passos

1. **Agora:** Use Tier 1 para v0.9 (simplificação UI)
2. **Depois:** Configure Tier 2 quando clínica piloto estiver ativa
3. **Futuro:** Tier 3 conforme necessidade

**Dúvida?** Veja `.agents/skills/[nome]/SKILL.md` para detalhe técnico de cada skill.
