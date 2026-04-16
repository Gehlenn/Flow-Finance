---
description: Gstack Complete - Full suite integration for MMORPG and Flow
---

# Gstack Full Integration

## Available Commands

### Development
- `/browse` - Test in headless browser
- `/qa` - Systematic testing + fixes
- `/qa-only` - Report-only testing
- `/investigate` - Debug with RCA
- `/codex` - AI code review

### Design
- `/design-review` - Visual QA
- `/design-html` - Production HTML/CSS
- `/design-shotgun` - Design variants

### Shipping
- `/ship` - Complete ship workflow
- `/land-and-deploy` - Merge + deploy + verify
- `/review` - Pre-landing PR review

### Planning
- `/plan-ceo-review` - Strategic review
- `/plan-eng-review` - Technical review
- `/plan-design-review` - Design planning

### Operations
- `/health` - Code quality dashboard
- `/canary` - Post-deploy monitoring
- `/benchmark` - Performance tracking

## Project-Specific Usage

### MMORPG
```bash
# Before release
/qa tier:exhaustive
/benchmark baseline

# After changes
/investigate bug:"mob movement"
/health check
```

### Flow Finance
```bash
# Security review
/cso mode:daily

# Deploy
/ship -> /land-and-deploy
```

## Shared Configuration
All tools use shared Obsidian vault for context.
