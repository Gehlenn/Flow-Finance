# Flow Finance Agent Instructions

This repository has project-specific operating rules. Read this file at the start of every session.

## Required Context

Before making substantial changes, read:

1. [Project Rules](E:/app e jogos criados/obsidian-vault/Projetos/Core/Project Rules.md)
2. [Product Plan](E:/app e jogos criados/obsidian-vault/Projetos/Core/Product Plan.md)
3. [Code Tasks](E:/app e jogos criados/obsidian-vault/Projetos/Core/Code Tasks.md)
4. [Project Stack Guide](E:/app e jogos criados/obsidian-vault/Projetos/Core/Project Stack Guide.md)
5. [30-Day Plan](E:/app e jogos criados/obsidian-vault/Projetos/Planning/30-Day Plan.md)
6. Relevant notes in `E:/app e jogos criados/obsidian-vault/Projetos/Planning/2026-04-flow-focus/` and root `*.md` files that affect the current task

## Documentation Reality

- The repository-local `obsidian-vault/` directory is not the active canonical planning source right now.
- The current canonical Flow notes live in `E:/app e jogos criados/obsidian-vault/Projetos/`.
- If the repo-local vault is repopulated later, this file must be updated explicitly instead of assuming both vaults are synchronized.

## Execution Rules

- Treat Flow Finance as a financial system with high integrity requirements.
- Default stance: technical, direct, and audit-friendly.
- Web and mobile are both first-class targets. Do not optimize one while regressing the other without explicit approval.
- Prefer existing installed skills when they materially improve quality or speed for the task.
- If a task matches a specialized installed skill, use it instead of improvising.
- For this repository, use `GSD` as the main execution spine unless there is a clear reason not to.
- Use `Superpowers` as execution/review support, not as a competing primary workflow.
- Use `context7` only when current library or platform docs are needed.
- Use `n8n-mcp` when the task touches external automation workflows or workflow orchestration.
- Use `UI/UX Pro Max` for clarity and hierarchy improvements after product simplification decisions are already clear.

## Project-Scoped Skills (Tier 1 Integration)

These skills are now available as part of Flow Finance workflow:

### Critical Path Skills
- **GSD** (`.agents/skills/gsd/`) — Release cycles, auditoria, test engineering, atomic commits
- **Gstack** (`.agents/skills/gstack/`) — QA automation, performance monitoring, E2E validation, canary deployment
- **UI/UX Pro Max** (`.agents/skills/ui-ux-pro-max/`) — Design audit, simplification, hierarchy, visual consistency

### When to Activate
- Release cycle: `/gsd-do [release task]` → audit → test → ship
- Pre-ship QA: `/qa` (full test+fix) or `/qa-only` (report only)
- Design audit: `/design-review` (live site) or `/design-shotgun` (exploration)
- Performance: `/benchmark` (baseline + tracking)

## Quality Gates

- Tests are mandatory for production-impacting changes.
- Security-sensitive flows require extra scrutiny: auth, Firestore rules, financial data handling, billing, currency conversion, and AI-driven classification.
- Document meaningful architectural or operational changes in Markdown when they affect future work.

## Version Transition Trigger

If the user says:

`Versão incrementada para [X.X.X]. Iniciar protocolo de transição.`

follow the transition protocol defined in:

[Project Rules](E:/app e jogos criados/obsidian-vault/Projetos/Core/Project Rules.md)

## Notes

- This file is the stable entry point for future Codex sessions.
- Additional project `.md` files should be consolidated into the canonical vault path above or the repository docs, and this file should be updated whenever that source of truth changes.
- Current product direction: simplify the app around cash flow, transactions, projected/realized revenue, consultative AI, and operational linkage for service businesses.
- The dental clinic is only a validation case, not the product identity.
- Current operating horizon: focus this repository only on `Flow Finance`. Parallel efforts such as channel/content work and standalone automation work do not belong to this project context.
