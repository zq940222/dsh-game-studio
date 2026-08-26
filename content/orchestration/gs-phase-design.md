---
name: gs-phase-design
description: Phase 2 of the studio pipeline - turning pillars into a GDD and a system list. Load when the concept is settled and systems need designing, or when a system's justification needs re-checking against the pillars.
---

# Phase 2 — Design

**Entry:** a concept document and named pillars.
**Deliverable:** a GDD and a system list.
**Gate:** every system traces to a pillar.

A system earns its place by serving a pillar, not by sounding fun on its
own. If you cannot point to which pillar a system supports, the system
does not belong in this GDD yet — park it, do not design around it.

## What to do

1. Read the concept document and pillars before drafting anything. Load
   `gs-pipeline` if you need a reminder of what came before this phase.
2. For each proposed system, write down the pillar it serves in one
   sentence. A system that serves no pillar is a feature request, not a
   design decision.
3. Produce the GDD from the studio template. Load `gs-templates` to pick
   it rather than inventing a shape.

## Delegating

The game designer owns this phase. Delegate with a gated hand-off,
because you need the GDD before checking the gate:

```
subagent(
  description: "GDD and system list",
  prompt: "Read %%GS_CONTENT_DIR%%roles/game-designer.md and adopt that
           role. Then: <the concept document and pillars>.",
  run_in_background: false)
```

Use the default background mode only when you are running several
departments at once, which this phase does not.

## Gate

Walk the system list and name the pillar behind each entry. A system
with no named pillar fails the gate — cut it or send it back for
revision. Review intensity for this installation is
`%%GS_REVIEW_INTENSITY%%`.
