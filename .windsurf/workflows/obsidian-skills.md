---
description: Obsidian Skills - Vault management and note operations
---

# Obsidian Skills Workflow

## Vault Paths
- **Main Vault**: `E:\app e jogos criados\obsidian-vault`
- **Graphify Output**: `E:\app e jogos criados\obsidian-graphify-out`

## Core Operations

### Note Management
```bash
# Create project note
obsidian-cli create "Projects/MMORPG/Features/[name]"

# Search across vault
obsidian-cli search "spawn system"

# Link notes
[[Projects/Flow-Finance/Architecture]]
```

### Knowledge Graph
```bash
# Generate graph
cd "E:\app e jogos criados\obsidian-vault"
graphify -i . -o "E:\app e jogos criados\obsidian-graphify-out"

# View graph
open "E:\app e jogos criados\obsidian-graphify-out\graph.html"
```

### Tag System
- `#mmorpg` - Eldoria game content
- `#flow-finance` - SaaS financial features
- `#shared` - Cross-project knowledge
- `#decision` - Technical decisions
- `#pattern` - Code patterns

## Quick Links
- MMORPG GDD: `[[Projects/MMORPG/GDD]]`
- Flow Architecture: `[[Projects/Flow-Finance/Architecture]]`
- Shared Patterns: `[[Patterns/Shared]]`
