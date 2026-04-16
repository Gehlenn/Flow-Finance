---
name: flow-finance-tools-setup
description: "Configure available skills and MCPs for Flow Finance development. Lists all installed development tools including GSD, GStack, UI/UX Pro Max, code validation, marketing skills, and vault integration tools."
applyTo: "**"
---

# Flow Finance - Tools & Skills Setup

**Date**: 15 April 2026  
**Status**: ✅ All 161 skills installed and synced to VS Code

## Quick Start

Type `/` in VS Code chat to access:
- `/gsd-do` — Orchestrate GSD workflows
- `/gsd-plan-phase` — Plan a development phase
- `/gstack-qa` — Run QA testing
- `/gstack-ship` — Ship code to production
- `/codigo-validado` — Add, validate, test code
- `/obsidian-cli` — Interact with vault from CLI
- `/ui-ux-pro-max` — Design review and optimization

## Installed Skills Categories

### 🚀 Development Orchestration (GSD + GStack)
**GSD** (Get Shit Done) - 70+ skills for planning and execution
- `gsd-do` — Route tasks to appropriate GSD command
- `gsd-plan-phase` — Create detailed phase plans
- `gsd-execute-phase` — Execute plans with atomic commits
- `gsd-verify-work` — Validate built features
- `gsd-check-todos` — List and prioritize pending todos
- `gsd-quick` — Execute trivial tasks inline
- `gsd-new-milestone` — Start new version cycle
- `gsd-ship` — Create PR, review, prepare for merge

**GStack** (QA, Deploy, Review) - 30+ skills for quality and deployment
- `gstack-qa` — Systematically QA test and fix bugs
- `gstack-review` — Pre-landing PR code review
- `gstack-ship` — Ship workflow: test, review, bump VERSION, PR
- `gstack-investigate` — Root cause investigation
- `gstack-design-review` — Visual QA and design polish
- `gstack-benchmark` — Performance regression detection
- `gstack-health` — Code quality dashboard
- `gstack-checkpoint` — Save working state
- `gstack-land-and-deploy` — Merge, deploy, verify

### 🛡️ Code Quality & Security
- `codigo-validado` — Add code with mandatory testing + lint
- `security-best-practices` — Security audit for JS/TS/Python
- `security-threat-model` — Repository threat modeling
- `security-ownership-map` — Security ownership analysis
- `code-quality-guard` — Enforce safe code with validation

### 🗂️ Vault & Documentation
- `obsidian-cli` — Interact with Obsidian vault via CLI
- `obsidian-markdown` — Create Markdown with Obsidian syntax
- `obsidian-bases` — Create/edit Obsidian Bases (data views)
- `json-canvas` — Create visual diagrams with Canvas
- `defuddle` — Extract clean markdown from web pages
- `graphify` — Generate knowledge graphs from codebase

### 🎨 Design & UX
- `ui-ux-pro-max` — Design audit: spacing, hierarchy, consistency
- `frontend-skill` — Build visually strong UIs and landing pages
- `page-cro` — Conversion rate optimization for web pages
- `signup-flow-cro` — Optimize signup/registration flows
- `form-cro` — Optimize non-signup forms
- `paywall-upgrade-cro` — Create/optimize in-app paywalls
- `popup-cro` — Create/optimize popups and modals
- `onboarding-cro` — Optimize post-signup activation

### 📈 Marketing & Growth (40+ skills)
- `cold-email` — Write B2B cold emails and follow-ups
- `copywriting` — Write persuasive marketing copy
- `email-sequence` — Design drip campaigns and nurture flows
- `paid-ads` — Strategy and optimization for Google/Meta/LinkedIn
- `analytics-tracking` — Set up GA4 and conversion tracking
- `seo-audit` — Technical and on-page SEO analysis
- `content-strategy` — Plan what content to create
- `competitor-alternatives` — Create vs/alternative pages
- `pricing-strategy` — Pricing architecture and monetization
- `launch-strategy` — Product launch and GTM planning

### 🧠 Context & Integration
- `claude-mem` — Persistent memory across sessions
- `context7` — Documentation and library context
- `n8n-mcp` — Integration with n8n workflow automation
- `notion-knowledge-capture` — Capture decisions to Notion
- `gstack-learn` — Manage project learnings over time

### ⚡ Optimization Tools
- `rtk` — Token optimizer (already validated at C:\Users\Danie\AppData\Local\Programs\rtk\)
  - Use: `rtk git diff` (80% reduction), `rtk npm test` (90-99%), `rtk lint` (84%)

## Configuration Files

**Workspace**: `.github/instructions/flow-finance-agent.instructions.md`
**Vault**: E:\app e jogos criados\obsidian-vault\Projetos\Projects\Flow Finance\
**User Prompts**: C:\Users\Danie\AppData\Roaming\Code\User\prompts\

## What NOT to do

❌ Don't manually commit without `/gsd-execute` or `/gstack-ship`  
❌ Don't QA by hand when `/gstack-qa` exists  
❌ Don't write code without running `/codigo-validado`  
❌ Don't ship without `/gstack-review`  

## Recommended Workflow

1. **Planning Phase**: `/gsd-plan-phase` → Create PLAN.md
2. **Development**: `/codigo-validado` → Write + test + lint
3. **QA**: `/gstack-qa` → Find and fix bugs
4. **Review**: `/gstack-review` → Structural analysis
5. **Ship**: `/gstack-ship` → Merge, VERSION, CHANGELOG, PR
6. **Deploy**: `/gstack-land-and-deploy` → Verify production

## Next Steps

- [ ] Restart VS Code to load all skills
- [ ] Type `/gsd-do` and test command routing
- [ ] Type `/gstack-health` to assess project quality
- [ ] Review E:\app e jogos criados\obsidian-vault for context
- [ ] Open Obsidian and enable graphify plugin (optional)

## References

- **GSD Docs**: https://github.com/pimzero/get-shit-done
- **GStack Docs**: https://github.com/gstack-ai/gstack
- **Obsidian Skills**: https://github.com/kepano/obsidian-skills
- **RTK Token Optimizer**: https://github.com/rtk-ai/rtk
- **Flow Finance Context**: E:\app e jogos criados\obsidian-vault\Projetos\Projects\Flow Finance\
