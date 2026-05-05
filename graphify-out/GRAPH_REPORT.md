# Graph Report - E:\app e jogos criados\obsidian-vault\Projetos\Planning\2026-04-flow-focus  (2026-04-24)

## Corpus Check
- Corpus is ~8,422 words - fits in a single context window. You may not need a graph.

## Summary
- 35 nodes · 89 edges · 5 communities detected
- Extraction: 3% EXTRACTED · 97% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `CI Wiring for gates` - 20 edges
2. `AI Behavior Criteria` - 14 edges
3. `Unified Transaction Intake Model` - 12 edges
4. `AI Backend-only Rule` - 9 edges
5. `Product Safety Rule: receivable ≠ cash` - 7 edges
6. `Flow Focus 2026-04 Bundle` - 6 edges
7. `Implementation Sequence (phases)` - 5 edges
8. `E2E Matrix Gate (cross-browser/mobile)` - 4 edges
9. `workspacePlan gating (Autopilot/AICFO)` - 4 edges
10. `AI Orchestrator Routing (disambiguation)` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Flow Focus 2026-04 Bundle` --conceptually_related_to--> `Product Scope & Positioning`  [INFERRED]
  README.md → 01_PRODUCT_SCOPE_AND_POSITIONING.md
- `Flow Focus 2026-04 Bundle` --conceptually_related_to--> `Business Integration Model`  [INFERRED]
  README.md → 02_BUSINESS_INTEGRATION_MODEL.md
- `Flow Focus 2026-04 Bundle` --conceptually_related_to--> `Business Integration Contract v1`  [INFERRED]
  README.md → 07_BUSINESS_INTEGRATION_CONTRACT.md
- `Flow Focus 2026-04 Bundle` --conceptually_related_to--> `AI Behavior Criteria`  [INFERRED]
  README.md → 09_AI_BEHAVIOR_CRITERIA.md
- `AI Orchestrator Routing (disambiguation)` --conceptually_related_to--> `AI Behavior Criteria`  [INFERRED]
  2026-04-23_ai-orchestrator-routing.md → 09_AI_BEHAVIOR_CRITERIA.md

## Hyperedges (group relationships)
- **Flow Focus Core Notes** — concept_product_scope_positioning, concept_business_integration_model, concept_integration_contract_v1, concept_unified_transaction_intake, concept_ai_behavior_criteria [INFERRED 0.80]
- **AI Reliability Contract** — concept_ai_backend_only_rule, concept_provider_policy_gemini_primary, concept_provider_policy_openai_fallback, concept_ai_behavior_criteria [INFERRED 0.78]
- **Delivery Quality Gates** — concept_e2e_matrix_gate, concept_ci_wiring, concept_encoding_mojibake_policy [INFERRED 0.75]

## Communities

### Community 0 - "AI Reliability"
Cohesion: 0.29
Nodes (4): AI Orchestrator Routing (disambiguation), CI Wiring for gates, Encoding / Mojibake Prevention, workspacePlan gating (Autopilot/AICFO)

### Community 1 - "AI Reliability"
Cohesion: 0.54
Nodes (4): AI Backend-only Rule, AI Behavior Criteria, Provider Policy: Gemini primary, Provider Policy: OpenAI fallback

### Community 2 - "Product & UI"
Cohesion: 0.33
Nodes (3): Flow Focus 2026-04 Bundle, Product Scope & Positioning, Unified Transaction Intake Model

### Community 3 - "Integration Contract"
Cohesion: 0.53
Nodes (3): E2E Matrix Gate (cross-browser/mobile), Implementation Sequence (phases), Business Integration Contract v1

### Community 4 - "Integration Contract"
Cohesion: 0.67
Nodes (2): Business Integration Model, Product Safety Rule: receivable ≠ cash

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CI Wiring for gates` connect `AI Reliability` to `AI Reliability`, `Product & UI`, `Integration Contract`, `Integration Contract`?**
  _High betweenness centrality (0.429) - this node is a cross-community bridge._
- **Why does `AI Behavior Criteria` connect `AI Reliability` to `AI Reliability`, `Product & UI`, `Integration Contract`, `Integration Contract`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `Unified Transaction Intake Model` connect `Product & UI` to `AI Reliability`, `AI Reliability`, `Integration Contract`, `Integration Contract`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `CI Wiring for gates` (e.g. with `2026-04-23_session-1-ci-deploy.md` and `01_PRODUCT_SCOPE_AND_POSITIONING.md`) actually correct?**
  _`CI Wiring for gates` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `AI Behavior Criteria` (e.g. with `09_AI_BEHAVIOR_CRITERIA.md` and `02_BUSINESS_INTEGRATION_MODEL.md`) actually correct?**
  _`AI Behavior Criteria` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `Unified Transaction Intake Model` (e.g. with `08_UNIFIED_TRANSACTION_INTAKE_MODEL.md` and `01_PRODUCT_SCOPE_AND_POSITIONING.md`) actually correct?**
  _`Unified Transaction Intake Model` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `AI Backend-only Rule` (e.g. with `09_AI_BEHAVIOR_CRITERIA.md` and `03_AI_AND_INPUT_ARCHITECTURE.md`) actually correct?**
  _`AI Backend-only Rule` has 9 INFERRED edges - model-reasoned connections that need verification._