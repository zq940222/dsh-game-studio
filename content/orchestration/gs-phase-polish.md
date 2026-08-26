---
name: gs-phase-polish
description: Phase 6 of the studio pipeline - measuring performance, accessibility, and feel against named targets. Load when features are complete and QA has passed, or when a polish target needs re-measuring.
---

# Phase 6 — Polish

**Entry:** features complete, QA evidence in hand.
**Deliverable:** performance, accessibility, and feel, each against a
named target.
**Gate:** targets are measured, not asserted.

"Feels good" is not a target; "input-to-action latency under a stated
threshold" is. If a target cannot be measured, it cannot pass this gate —
rewrite it until it can.

## What to do

1. Name a target for each polish dimension before measuring anything —
   performance, accessibility, and feel each need one.
2. Measure against the named target and record the number, not an
   impression.
3. Where a target is missed, decide with the user whether to fix it or
   revise the target — do not silently lower the bar.

## Delegating

The technical director and the UX designer share this phase — performance
targets to one, feel and accessibility targets to the other. Delegate
each with a gated hand-off, because you need the measurement before
checking the gate:

```
subagent(
  description: "performance targets",
  prompt: "Read %%GS_CONTENT_DIR%%roles/technical-director.md and adopt
           that role. Then: measure <the named performance targets>.",
  run_in_background: false)
```

```
subagent(
  description: "feel and accessibility targets",
  prompt: "Read %%GS_CONTENT_DIR%%roles/ux-designer.md and adopt that
           role. Then: measure <the named feel and accessibility
           targets>.",
  run_in_background: false)
```

This phase does not run its checks in the default background mode —
running several departments in parallel is Sprint's pattern, not this
phase's. Wait for each measurement before deciding the gate.

## Gate

Every named target needs a measured number next to it, not a description
of how it felt. Review intensity for this installation is
`%%GS_REVIEW_INTENSITY%%`.
