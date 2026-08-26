---
name: gs-phase-release
description: Phase 7 of the studio pipeline - turning a polished build into a release checklist, notes, and a day-one plan. Load when polish targets are hit and the project is ready for release, or when a checklist item needs re-verifying.
---

# Phase 7 — Release

**Entry:** polish targets measured and hit.
**Deliverable:** a release checklist, release notes, and a day-one plan.
**Gate:** the checklist is complete and no blockers are open.

An open blocker with a plan to fix it later is still an open blocker. The
gate does not ask whether a blocker is scary, only whether it is open.

## What to do

1. Build the release checklist from the studio template. Load
   `gs-templates` to pick it rather than inventing a shape.
2. Write release notes from the perspective of a player who has not seen
   any of the earlier phases' documents.
3. Draft the day-one plan: what gets watched, who watches it, and what
   triggers a rollback.

## Delegating

The release manager owns this phase. Delegate with a gated hand-off,
because you need the checklist before checking the gate:

```
subagent(
  description: "release checklist and notes",
  prompt: "Read %%GS_CONTENT_DIR%%roles/release-manager.md and adopt that
           role. Then: <the polish results and day-one plan inputs>.",
  run_in_background: false)
```

Use the default background mode only when you are running several
departments at once, which this phase does not.

## Gate

Walk the checklist item by item. Anything unchecked or marked blocked
fails the gate — there is no partial pass for a release. Review
intensity for this installation is `%%GS_REVIEW_INTENSITY%%`.
