---
status: investigating
trigger: "Investigate and fix the next visible diagnostic gap in Open Banking for Flow Finance. Summary: The Open Banking page already surfaces several errors, but we want to reinforce UX diagnostics so users always see an actionable next step when reload/token/connector/backend issues happen."
created: 2026-05-08T00:00:00-03:00
updated: 2026-05-08T00:00:00-03:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: The prior Open Banking hardening added visible errors, but at least one failure class still renders without a consistent next-step hint or with a different helper pattern than the rest.
test: Read the Open Banking page, service layer, and tests to compare how reload, token, connector, sync, and disconnect failures choose user-facing copy.
expecting: I will find one or more remaining ad hoc error branches that omit the diagnostic next step or bypass the shared message path.
next_action: Inspect the current Open Banking implementation and identify the exact branch that still lacks unified guidance.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: When Open Banking fails to load bank connections, token retrieval fails, or connector sync/connect actions fail, the UI should show a clear diagnostic message and next step.
actual: Some errors are already surfaced, but the next-step guidance is inconsistent and not unified across reload / token / connector / action failures.
errors: No specific runtime error yet; this is a UX hardening pass based on existing error states.
reproduction: Trigger Open Banking reload failure or a Pluggy token/connectors/status failure, or a connect/disconnect/sync action error.
started: Existing issue in current codebase; not a regression from this session.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-08T00:00:00-03:00
  checked: Memory search for Flow Finance Open Banking diagnostics and the prior 2026-05-07 rollout summary
  found: The previous rollout already added diagnostics in `openBankingService.ts` and `OpenBanking.tsx`, including visible Pluggy load, reload, sync, and disconnect failures, so the remaining gap is likely a narrower consistency issue.
  implication: Focus on the branches and copy variants that were not fully normalized rather than adding brand-new error surfaces.
## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: 
fix: 
verification: 
files_changed: []
