# Flow Finance Code Tasks

Consolidated from `FLOW-FINANCE-CODE-TASKS.md` on 2026-04-07.

Use this together with:

- [FLOW_FINANCE_PRODUCT_PLAN.md](E:/app%20e%20jogos%20criados/Flow-Finance/docs/FLOW_FINANCE_PRODUCT_PLAN.md)

## Primary Skills For This Cycle

- `GSD` for scope control, phases, and execution order
- `Superpowers` for planning quality, review, verification, and debugging
- `context7` only when library/platform docs are genuinely needed
- `UI/UX Pro Max` for focus and clarity after product decisions are established
- `gstack` only for punctual review or QA

## Operational Rules

Priority:

- simplify Flow Finance around cash flow, transactions, useful dashboard, projected/realized revenue, consultative AI, and operational linkage

Avoid:

- reintroducing Open Finance in the main UI
- opening large new feature fronts
- refactoring architecture without objective need
- spending time on cosmetic work without clarity gain
- expanding the AI assistant scope prematurely

## Recommended Technical Sequence

### Stage 1: UI audit

- locate Open Finance / Pluggy components, routes, menu items, cards, and text
- map affected files
- summarize what will be removed, hidden, or rewritten

### Stage 2: Remove or hide Open Finance from the main UI

- remove or hide menu items
- remove or hide routes from primary navigation
- remove cards, banners, shortcuts, and visible references
- preserve reusable code when reasonable, but keep it out of the current experience

### Stage 3: Simplify navigation

Prioritize access to:

- dashboard
- transactions
- categories and organization
- projected and realized revenue
- consultative assistant
- essential settings

### Stage 4: Review dashboard

Increase emphasis on:

- current balance
- inflows
- outflows
- projected revenue
- confirmed/paid revenue
- simple practical alerts

Reduce emphasis on non-essential modules and overblown copy.

### Stage 5: Review AI assistant positioning

Keep the assistant focused on:

- financial summaries
- data reading
- simple alerts
- practical questions

Reduce exaggerated language.

### Stage 6: Revise microcopy

Favor language around:

- cash flow
- operations
- financial clarity
- intelligent support

### Stage 7: Technical validation

- run build
- run relevant tests
- validate primary navigation
- ensure there are no broken links, orphan routes, or inconsistent states
- validate key areas visually

### Stage 8: Document changes

Record:

- changed components
- removed or hidden UI items
- frozen-but-preserved code
- next-cycle pending items

## Definition of Done For This Cycle

The cycle is successful when:

- the app feels simpler and more focused
- Open Finance no longer competes for attention in the main UI
- navigation makes the core product obvious
- the dashboard communicates cash and decision support
- the AI assistant feels useful and plausible
- the app remains functional after simplification

## Prompt Base For Coding Sessions

Use this as the default execution framing:

> Read `FLOW_FINANCE_PRODUCT_PLAN.md` and `FLOW_FINANCE_CODE_TASKS.md`. Simplify Flow Finance to reflect the current product focus: intelligent cash flow for service businesses, connected to real operations. Start with UI audit, Open Finance/Pluggy removal from the main experience, and navigation simplification. Preserve reusable code when reasonable, but remove frozen scope from the primary user experience. At the end, document changed files, completed changes, and remaining pending items.
