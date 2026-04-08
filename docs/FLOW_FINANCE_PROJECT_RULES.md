# Flow Finance Project Rules

Source consolidated from `FLOW_FINANCE_PROMPT_MESTRE.md` on 2026-04-07.

## Project Identity

- Platform: intelligent financial management system
- Targets: Web and mobile
- Base stack: Next.js, React Native, Firebase/Firestore, TypeScript, Vercel
- Quality target: `>= 9/10` per module

## Operating Roles

Treat the project as requiring simultaneous perspectives from:

- Senior full-stack engineer
- QA automation specialist
- SaaS solutions architect
- Financial AppSec specialist
- AI/ML engineer for behavioral finance
- Fintech UX/UI architect
- Data and analytics engineer

These are review lenses, not roleplay. Use them to improve architecture, testing, security, UX, AI, and data decisions.

## Core Mission

Architect, audit, and evolve Flow Finance as a financial platform across web and mobile with these non-negotiable pillars:

1. Financial data integrity above all
2. Performance and scalability from day one
3. Tested quality, never assumed
4. AI as product leverage, not decoration
5. Architecture ready for SaaS and future multi-tenancy

## Non-Negotiable Rules

1. Tone must stay technical and professional.
2. Do not consider work complete if logic is broken or tests are failing.
3. Financial security is non-negotiable.
4. Minimize compute cost while preserving security and performance.
5. Documentation is treated with the same rigor as code.
6. Web and mobile are first-class citizens.
7. Technical debt must be recorded when discovered, even if not fixed immediately.

## Engineering Priorities

### Architecture

- Prefer clean, scalable, secure architecture
- Apply SOLID, DRY, and KISS pragmatically
- Reduce technical debt continuously
- Keep SaaS-readiness in view: auth, billing, quotas, feature flags, tenancy boundaries

### Performance

- Aim for Lighthouse `>= 90` where applicable
- Investigate bottlenecks instead of guessing
- Watch both UI performance and data path efficiency

### Testing

- The source prompt sets a hard target of `>= 98%` coverage
- For this repository, treat that as a strict project aspiration and use it as a forcing function for high test rigor
- Never silently proceed past untested critical financial flows
- Critical flows include:
  - currency conversion and exchange flows
  - real-time balance synchronization
  - AI categorization
  - data persistence and integrity
  - authentication and access control
  - payment and billing flows
  - Firestore security rules

### Security

- Review OWASP Top 10 exposure when touching critical surfaces
- Validate and sanitize all financial input paths
- Protect sensitive data and PII
- Treat Firestore rules as production security boundaries
- Check dependency risk when modifying dependencies

### UX

- Keep UX coherent between web and mobile
- Maintain a consistent design system
- Accessibility target: WCAG 2.1 AA minimum
- Financial workflows must feel clear, trustworthy, and low-friction

### Data and Analytics

- Preserve referential and business integrity of financial data
- Prefer auditability in analytics and export flows
- Treat reporting, exports, and derived metrics as product-critical

## Preferred Specialized Skills

Use installed skills when relevant. In this project, especially consider:

- `gsd-*` as the primary project workflow spine for scope, phases, backlog, and execution order
- `superpowers` for planning quality, code review, verification, and debugging support
- `gstack-*` for punctual QA, review, investigation, and learnings, not as the main parallel workflow
- `codex-memory` to persist reusable context for future sessions
- `security-best-practices` when explicitly doing security review work
- `frontend-skill` and related UI skills for meaningful frontend design work
- `context7-cli` or `find-docs` when library documentation needs current verification
- `n8n-mcp` when work touches clinic automation
- `marketing-skills` later for positioning, landing page, and monetization support
- `obsidian-skills` for durable external documentation and knowledge organization when needed

## Project Memory Policy

For durable continuity across sessions:

- Store reusable project truths as learnings
- Store resumable investigations and multi-session work as threads
- Store short-form reminders and decisions as notes

Use the `codex-memory` workflow when the user asks to remember, resume, or persist context.

## Current Product Direction

The current direction is simplification, not expansion.

Product positioning:

**Flow Finance is an intelligent cash-flow app for service businesses, connected to real operations.**

Interpretation for implementation:

- prioritize cash flow clarity
- prioritize transactions and financial records that are actually useful
- prioritize projected and realized revenue
- prioritize links between operations and finance
- keep AI consultative and credible
- remove or de-emphasize frozen or distracting scope

### Current validation case

- primary service-business validation case: dental clinic

### Explicitly de-prioritized for now

- Open Finance / Pluggy in the main UI
- broad autonomous-AI claims
- expensive features without short-term validation value
- large architectural expansion without product justification

### UI simplification rule

When making product-facing changes, prefer:

- clearer navigation
- less feature competition
- more emphasis on cash, transactions, projected revenue, realized revenue, and practical alerts

Do not let frozen capabilities compete for attention in the main experience.

## Execution Bias For Current Cycle

When acting on the current product cycle:

1. audit current UI and flows
2. remove or hide Open Finance / Pluggy from the main experience
3. simplify navigation
4. revise dashboard emphasis
5. revise AI assistant positioning
6. revise microcopy
7. validate app behavior
8. document what changed and what remains frozen

## Version Transition Protocol

Trigger phrase:

`Versão incrementada para [X.X.X]. Iniciar protocolo de transição.`

When this exact trigger appears, execute in this order:

### Step 1: Systemic Audit

- analyze architectural inconsistencies
- review OWASP-style security exposure
- identify performance bottlenecks
- verify web/mobile consistency
- detect duplication and bad patterns
- assess accumulated technical debt

### Step 2: QA and Test Engineering

- generate and run unit and integration tests
- treat coverage as a hard gate for the transition workflow
- validate critical financial flows explicitly

### Step 3: Documentation Evolution

Update the relevant Markdown set, especially:

- `README.md`
- roadmap-related files
- design/system/business rules documentation
- changelog or release notes
- bug/debt log

If equivalent file names differ from the source prompt, update the nearest existing project documents instead of inventing mismatched structure without reason.

## Mandatory Output Shape For Transition Audits

For version transition work, structure the response with these sections:

1. Audit report
2. Tests and coverage
3. Documentation package
4. Security report
5. Engineering insights

Keep the content technical, direct, and decision-oriented.

## Practical Interpretation Notes

- The source prompt is stronger than the current repository may fully support today.
- Apply it as an operating standard and escalation policy.
- If the repository falls short of one of these standards, state that explicitly rather than pretending compliance exists.
