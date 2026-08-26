---
name: gs-phase-sprint
description: Phase 4 of the studio pipeline - turning a technical design into epics, stories, and working implementation. Load when architecture is settled and work needs breaking into stories, or when a story's acceptance criteria need checking.
---

# Phase 4 — Sprint

**Entry:** a technical design and ADRs, decisions already made.
**Deliverable:** epics, stories, and implementation.
**Gate:** every story has acceptance criteria.

A story without acceptance criteria cannot be marked done — it can only
be marked "someone stopped working on it." Acceptance criteria are what
make the difference visible from outside the implementer's head.

## What to do

1. Break the technical design into epics, then into stories small enough
   to finish and verify independently.
2. Write acceptance criteria for each story before implementation
   starts, not after. A criterion written after the fact tends to
   describe what shipped rather than what was promised.
3. Run departments in parallel where the work is genuinely independent —
   this is the one phase that routinely does.

## Delegating

The lead programmer owns this phase. Two different delegations happen
here, and they use different modes:

**Parallel department work** — several departments implementing
independent stories at once. Use the default background mode, keep
working, and collect each settlement notice as it lands:

```
subagent(
  description: "combat system story",
  prompt: "Read %%GS_CONTENT_DIR%%roles/lead-programmer.md and adopt that
           role. Then: <the story and its acceptance criteria>.")
```

**The gate re-check** — confirming every story has acceptance criteria
before the sprint closes. You need the answer before proceeding, so this
one is gated:

```
subagent(
  description: "acceptance criteria audit",
  prompt: "Read %%GS_CONTENT_DIR%%roles/lead-programmer.md and adopt that
           role. Then: confirm every story in this sprint has acceptance
           criteria, and list any that do not.",
  run_in_background: false)
```

## Gate

Every story needs acceptance criteria before the sprint is done — no
exceptions for stories that felt too small to bother. Review intensity
for this installation is `%%GS_REVIEW_INTENSITY%%`.
