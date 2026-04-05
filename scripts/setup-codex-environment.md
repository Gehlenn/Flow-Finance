# Codex Environment Setup

This script reproduces the current global Codex setup as closely as possible:

- `superpowers`
- `ui-ux-pro-max`
- `context7` skills
- `gstack`
- `get-shit-done`
- `obsidian-skills`
- `marketingskills`
- `codex-memory`
- `n8n-mcp` config

Script:

- [scripts/setup-codex-environment.ps1](scripts/setup-codex-environment.ps1)

Recommended usage:

```powershell
.\scripts\setup-codex-environment.ps1
```

Notes:

- It writes to `~/.codex`, `~/.gstack`, `~/.gsd`, and `~/.agents`.
- It assumes `git`, `node`, `npm`, and `bun` are available.
- It uses official installers where they exist and manual copy steps where they do not.
- `n8n-mcp` is configured in documentation mode only. Add `N8N_API_URL` and `N8N_API_KEY` later if you want live instance access.
- Re-run after cleanup or on a new machine, then restart Codex.
