---
description: Claude-Mem - Persistent memory and context management
---

# Claude-Mem Workflow

## Overview
Cross-project memory system using shared Obsidian vault.

## Vault Configuration
```yaml
vault_path: "E:\\app e jogos criados\\obsidian-vault"
graphify_output: "E:\\app e jogos criados\\obsidian-graphify-out"
projects:
  - MMORPG de browser
  - Flow-Finance
```

## Memory Types

### 1. Technical Decisions
Store in: `.planning/decisions/`
Format: `DECISION-[YYYY-MM-DD]-[topic].md`

### 2. Code Patterns
Store in: `.planning/patterns/`
Format: `PATTERN-[name].md`

### 3. Project Context
Store in vault root
Tags: #mmorpg #flow-finance #shared

## Usage
```bash
# Create memory
create_memory -t "technical_decision" -p "MMORPG"

# Search memories
grep_search -q "pattern" -p "E:\\app e jogos criados\\obsidian-vault"

# Sync to Graphify
graphify -i "E:\\app e jogos criados\\obsidian-vault" -o "E:\\app e jogos criados\\obsidian-graphify-out"
```
