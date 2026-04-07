# Flow Finance Agent Instructions

This repository has project-specific operating rules. Read this file at the start of every session.

## Required Context

Before making substantial changes, read:

1. [FLOW_FINANCE_PROJECT_RULES.md](docs/FLOW_FINANCE_PROJECT_RULES.md)
2. [FLOW_FINANCE_PRODUCT_PLAN.md](docs/FLOW_FINANCE_PRODUCT_PLAN.md)
3. [FLOW_FINANCE_CODE_TASKS.md](docs/FLOW_FINANCE_CODE_TASKS.md)
4. [PROJECT_STACK_GUIDE.md](docs/PROJECT_STACK_GUIDE.md)
5. [PLAN_30D.md](docs/PLAN_30D.md)
6. Relevant project docs in `docs/` and root `*.md` files that affect the current task

## Execution Rules

- Treat Flow Finance as a financial system with high integrity requirements.
- Default stance: technical, direct, and audit-friendly.
- Web and mobile are both first-class targets. Do not optimize one while regressing the other without explicit approval.
- Prefer existing installed skills when they materially improve quality or speed for the task.
- If a task matches a specialized installed skill, use it instead of improvising.
- For this repository, use `GSD` as the main execution spine unless there is a clear reason not to.
- Use `Superpowers` as execution/review support, not as a competing primary workflow.
- Use `context7` only when current library or platform docs are needed.
- Use `n8n-mcp` when the task touches clinic automation or workflow orchestration.
- Use `UI/UX Pro Max` for clarity and hierarchy improvements after product simplification decisions are already clear.

## Quality Gates

- Tests are mandatory for production-impacting changes.
- Security-sensitive flows require extra scrutiny: auth, Firestore rules, financial data handling, billing, currency conversion, and AI-driven classification.
- Document meaningful architectural or operational changes in Markdown when they affect future work.

## Version Transition Trigger

If the user says:

`Versão incrementada para [X.X.X]. Iniciar protocolo de transição.`

follow the transition protocol defined in:

[FLOW_FINANCE_PROJECT_RULES.md](docs/FLOW_FINANCE_PROJECT_RULES.md)

## Notes

- This file is the stable entry point for future Codex sessions.
- Additional project `.md` files provided later should be consolidated into `docs/` and referenced from here.
- Current product direction: simplify the app around cash flow, transactions, projected/realized revenue, consultative AI, and operational linkage for service businesses, starting with the dental clinic case.
- Current operating horizon: focus this repository only on `Flow Finance + clínica`. Parallel efforts such as channel/content work do not belong to this project context.
