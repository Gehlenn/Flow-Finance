---
description: Graphify - Knowledge graph visualization for Obsidian
---

# Graphify Workflow

## Purpose
Transform Obsidian vault into interactive knowledge graphs for better context understanding.

## Configuration
```yaml
input: "E:\\app e jogos criados\\obsidian-vault"
output: "E:\\app e jogos criados\\obsidian-graphify-out"
ignore: [".git", "node_modules", ".obsidian"]
```

## Commands

### Generate Graph
```bash
# Full vault graph
cd "E:\app e jogos criados\obsidian-vault"
graphify -i . -o "E:\app e jogos criados\obsidian-graphify-out"

# Project-specific
graphify -i "Projects/MMORPG" -o "E:\app e jogos criados\obsidian-graphify-out/graph-mmorpg"
graphify -i "Projects/Flow-Finance" -o "E:\app e jogos criados\obsidian-graphify-out/graph-flow"
```

### Integration with Cascade
- Use `.graphifyignore` to exclude files
- Auto-generate on major project milestones
- View in browser: `graphify-out/graph.html`

## Usage in Skills
```javascript
// Before major refactoring
run_command: `graphify -i "${vaultPath}" -o "${outputPath}"`

// After memory creation
update_graph: true
```
