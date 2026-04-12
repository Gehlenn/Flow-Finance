# RTK (Rust Token Killer) - Token Optimization

## Descrição
Ferramentas de otimização de tokens para reduzir consumo em operações com output volumoso (diffs, logs, queries, build output, etc).

## Quando Usar
- Diffs longos com muitas mudanças (Git diffs, PRs grandes)
- Logs compactos (Docker logs, test output, build logs)
- Listar dependências (pnpm list, npm outdated)
- Buscar/grep em arquivos (arquivo com muitas linhas)
- Operações que geram output > 10KB

## Comandos Principais

### Git (59-80% economia)
```bash
rtk git status              # Status compacto
rtk git log --oneline       # Log conciso
rtk git diff                # Diff com 80% redução
rtk git show [commit]       # Commit info compacta
```

### Build & Compile (80-90% economia)
```bash
rtk cargo build             # Cargo output comprimido
rtk tsc                     # TypeScript errors agrupados (83%)
rtk npm run build           # Build output conciso
```

### Test (90-99% economia)
```bash
rtk vitest run              # Vitest failures apenas (99.5%)
rtk npm test                # Test failures apenas
```

### Dependências (70-80% economia)
```bash
rtk pnpm list               # Dependency tree compacta
rtk pnpm outdated           # Outdated packages compacta
```

### Arquivos & Search (60-75% economia)
```bash
rtk ls <path>               # Tree format compacto
rtk grep <pattern> <file>   # Search agrupado por arquivo
```

## Integração com Flow Finance

### Casos de Uso
1. **PRs grandes** — Revisar diffs de release sem 30KB de contexto
2. **Test output longos** — Ver apenas failures em testes críticos
3. **Build logs** — Capturar apenas warns/errors
4. **Dependency reviews** — Listar packages de forma compacta

### Exemplo: Release v0.9.1
```bash
# Revisar mudanças sem reler tudo
rtk git diff origin/main

# Ver apenas testes que falharam
rtk npm run test:critical

# Verificar vulnerabilidades
rtk npm audit
```

## Instalação

### Option 1: Global (Recomendado)
```bash
# Windows
choco install rtk
# ou
scoop install rtk

# macOS
brew install rtk

# Linux
cargo install rtk
```

### Option 2: Local (sem instalação)
```bash
# Baixar binary de https://github.com/rtk-ai/rtk/releases
# Copiar para C:\Users\Danie\AppData\Local\Programs\rtk\
```

## Status
- 🟡 Opcional para v0.9 (nice-to-have)
- ✅ Recomendado para sessões longas (> 50K tokens)
- ✅ Particularmente útil em PRs grandes

---
**Repositório:** https://github.com/rtk-ai/rtk  
**Documentação:** [GitHub Wiki](https://github.com/rtk-ai/rtk/wiki)
