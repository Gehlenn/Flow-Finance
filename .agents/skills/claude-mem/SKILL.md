# Claude-Mem - Flow Finance Memory Persistence

## Descrição
Skill para persistência de contexto e decisões entre sessões. Rastreia:
- Decisões técnicas tomadas
- Padrões de refatoração aplicados
- Aprendizados do projeto
- Estado de trabalho em progresso
- Configurações e setup validados

## Quando Usar
- Resgatar contexto de sessão anterior
- Evitar repetir decisões arquiteturais
- Rastrear aprendizados (bugs, patterns, gotchas)
- Retomar trabalho interrompido
- Manter histórico de decisões para auditoria

## Estrutura de Memória Flow Finance

### User Memory (`/memories/`)
- **flow-finance-protocol.md** — Protocolo obrigatório de versão, cobertura 98%, diretrizes
- **preferences.md** — Preferências de trabalho (idioma PT-BR, tom profissional)

### Session Memory (`/memories/session/`)
- **skills-integration-plan.md** — Progresso de integração de skills
- **[current-task].md** — Contexto da tarefa em andamento (fase, próximos passos)

### Repo Memory (`/memories/repo/`)
- **CORS-FIX-LOG.md** — Histórico de fix CORS
- **E2E-SPLASH-STABILIZATION.md** — Estabilização de splash screen
- **FINANCE-ENGINE-VALIDATION.md** — Validação da engine financeira
- **GEMINI-MODEL-RESOLUTION.md** — Resolução de modelo Gemini

## Workflow com Claude-Mem

### Início de Sessão
```bash
# Ler contexto persistente
/memory view /memories/flow-finance-protocol.md
/memory view /memories/session/

# Continuar de onde parou
/gsd-resume-work
```

### Durante Sessão
```bash
# Capturar decisão
/memory create /memories/session/decision.md

# Atualizar progresso
/memory str_replace /memories/session/plan.md [old] [new]

# Rastrear aprendizado
/memory create /memories/repo/PATTERN-[name].md
```

### Fim de Sessão
```bash
# Checkpoint de estado
/gsd-pause-work

# Limpar obsoletos
/memory delete /memories/session/[stale].md
```

## Cases de Uso

### Case 1: Retomar Release v0.9.1
```
Session: "resumed work from session"
Context: /memories/session/gsd-v091-release.md
```
→ Arquivo indica: "Faltam testes, audit passou, docs pendentes"
→ Continua da fase certa

### Case 2: Bug Similar Encontrado
```
/memory view /memories/repo/GEMINI-MODEL-RESOLUTION.md
```
→ Descreve: "Modelo gemini-2.0 tinha latência > 2s em categorização"
→ Aplicar fix conhecida sem reexperimento

### Case 3: 30-Day Plan Tracking
```
/memory view /memories/session/30d-progress.md
```
→ Mostra sinais positivos (4/5 buscados)
→ Permite replanejamento informed

## Status
- ✅ Manuais `/memory` já funcionam (built-in)
- 🟡 Plugin oficial `claude-mem` para automação (opcional)
- 🟡 Integração com `/gsd-pause-work` e `/gsd-resume-work`

## Recomendação
Use `/memory` manualmente por enquanto. Upgrade para plugin oficial quando necessário.

---
**Repositório:** Plugin Marketplace (claude-mem)  
**Documentação Memory:** [memory](../../.memory) | [AGENTS.md](../../AGENTS.md)
