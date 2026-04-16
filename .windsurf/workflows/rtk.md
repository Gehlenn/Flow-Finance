---
description: RTK - Token optimizer for cost-effective AI usage
---

# RTK Token Optimizer

## Purpose
Optimize token usage across long-running projects to reduce costs.

## Strategies

### 1. Context Pruning
- Remove obsolete memories after 30 days
- Archive completed milestones
- Compress code snippets to references only

### 2. Efficient Queries
```javascript
// Instead of: "Explain the entire codebase"
// Use: code_search for specific areas

// Instead of: Full file reads
// Use: read_file with offset/limit
```

### 3. Caching
- Cache graphify outputs
- Store search results in Obsidian
- Reuse architecture decisions

## Token Budget per Project
- **MMORPG**: Focus on gameplay systems
- **Flow Finance**: Focus on financial logic
- **Shared**: Architecture patterns only

## Auto-Optimization
```yaml
rules:
  - after_50_turns: summarize_conversation
  - after_completion: archive_to_obsidian
  - before_search: check_cached_results
```
