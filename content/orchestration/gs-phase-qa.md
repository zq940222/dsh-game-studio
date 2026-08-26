---
name: gs-phase-qa
description: Phase 5 of the studio pipeline - turning acceptance criteria into test plans and evidence. Load when implementation is ready for verification, or when a claimed pass needs its evidence checked.
---

# Phase 5 — QA

**Entry:** implementation against stories with acceptance criteria.
**Deliverable:** test plans and evidence.
**Gate:** evidence exists for every acceptance criterion.

"Tested" is not evidence; a screenshot, a log, or a reproducible test run
is. If nobody but the implementer can confirm a criterion passed, it did
not pass the gate yet.

## What to do

1. Turn each story's acceptance criteria into a test plan — what to run,
   what result counts as a pass.
2. Execute the plan and capture evidence as you go, not after the fact
   from memory.
3. Produce the test plan and evidence log from the studio template. Load
   `gs-templates` to pick it rather than inventing a shape.

## Delegating

The QA lead owns this phase. Delegate with a gated hand-off, because you
need the evidence before checking the gate:

```
subagent(
  description: "test plan and evidence",
  prompt: "Read %%GS_CONTENT_DIR%%roles/qa-lead.md and adopt that role.
           Then: <the stories and their acceptance criteria>.",
  run_in_background: false)
```

Use the default background mode only when you are running several
departments at once, which this phase does not.

## Gate

Walk every acceptance criterion and point at its evidence. A criterion
with no evidence fails the gate, even if the feature visibly works.
Review intensity for this installation is `%%GS_REVIEW_INTENSITY%%`.
