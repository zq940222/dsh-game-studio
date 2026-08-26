---
name: gs-phase-architecture
description: Phase 3 of the studio pipeline - turning a GDD into a technical design and a set of ADRs. Load when systems are designed and need an implementation plan, or when a past decision's consequences need revisiting.
---

# Phase 3 — Architecture

**Entry:** a GDD with a system list, each system tracing to a pillar.
**Deliverable:** a technical design and a set of ADRs.
**Gate:** every ADR has a decision and consequences.

An ADR that records only the decision is half a document. The
consequences section is what stops the next person from re-litigating a
choice without knowing what it already cost.

## What to do

1. Read the GDD and system list. Each system needs at least one
   technical decision behind it — data model, engine feature, or
   third-party dependency.
2. Write one ADR per decision that would be expensive to reverse. Not
   every choice needs one; a choice you would make the same way twice
   does not.
3. Produce the technical design from the studio template. Load
   `gs-templates` to pick it rather than inventing a shape.

## Delegating

The technical director owns this phase. Delegate with a gated hand-off,
because you need the ADRs before checking the gate:

```
subagent(
  description: "technical design and ADRs",
  prompt: "Read %%GS_CONTENT_DIR%%roles/technical-director.md and adopt
           that role. Then: <the GDD and system list>.",
  run_in_background: false)
```

Use the default background mode only when you are running several
departments at once, which this phase does not.

## Gate

Read each ADR and confirm it states both a decision and its
consequences. An ADR missing either half fails the gate. Review
intensity for this installation is `%%GS_REVIEW_INTENSITY%%`.
