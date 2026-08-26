---
name: gs-phase-concept
description: Phase 1 of the studio pipeline - turning an idea into named pillars and a concept document. Load when the project has no design yet, or when the pillars need revisiting because later work contradicted them.
---

# Phase 1 — Concept

**Entry:** an idea, and nothing written down yet.
**Deliverable:** a concept document and three to five named pillars.
**Gate:** the pillars are named, non-contradictory, and each one excludes something.

A pillar that excludes nothing is a slogan. "Fun combat" is a slogan;
"combat rewards positioning over reflexes" is a pillar, because it tells
you what to cut.

## What to do

1. Ask the user what the game is, who it is for, and what it is not.
   Do not skip the third question — it is where pillars come from.
2. Draft three to five pillars. Show them and get agreement before writing
   anything longer.
3. Produce the concept document from the studio template. Load
   `gs-templates` to pick it rather than inventing a shape.

## Delegating

The creative director owns this phase. Delegate with a gated hand-off,
because you need the answer before drafting:

```
subagent(
  description: "concept pillars",
  prompt: "Read %%GS_CONTENT_DIR%%roles/creative-director.md and adopt that
           role. Then: <the framing question>.",
  run_in_background: false)
```

Use the default background mode only when you are running several
departments at once, which this phase does not.

## Gate

Present each pillar with what it excludes. If the user cannot name a
consequence for a pillar, it is not a pillar yet. Review intensity for
this installation is `%%GS_REVIEW_INTENSITY%%`.
