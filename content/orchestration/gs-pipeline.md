---
name: gs-pipeline
description: The seven-phase production pipeline and the gate between each phase. Load when deciding what phase the project is in, what must be true before it advances, and which command drives the next step.
---

# The pipeline

Seven phases. Each has an entry condition, a deliverable, and a gate that
must pass before the next begins. Review intensity for this installation
is `%%GS_REVIEW_INTENSITY%%`, which decides how much of each gate is
mandatory — `full` runs every check, `lean` runs the ones marked
essential, `solo` runs the deliverable check only.

| # | Phase | Deliverable | Gate | Skill |
|---|---|---|---|---|
| 1 | Concept | Game concept, pillars | Pillars named and non-contradictory | `gs-phase-concept` |
| 2 | Design | GDD, systems | Every system traces to a pillar | `gs-phase-design` |
| 3 | Architecture | Technical design, ADRs | Every ADR has a decision and consequences | `gs-phase-architecture` |
| 4 | Sprint | Epics, stories, implementation | Every story has acceptance criteria | `gs-phase-sprint` |
| 5 | QA | Test plans, evidence | Evidence exists for every acceptance criterion | `gs-phase-qa` |
| 6 | Polish | Performance, accessibility, feel | Named targets measured, not asserted | `gs-phase-polish` |
| 7 | Release | Checklist, notes, day-one plan | Checklist complete, no open blockers | `gs-phase-release` |

The full narrative walkthrough is at
`%%GS_CONTENT_DIR%%pipeline/workflow-guide.md`; the machine-readable phase
and step list is at `%%GS_CONTENT_DIR%%pipeline/workflow-catalog.md`.

## How to use this

Do not run phases you have no input for. If the project already has a
GDD, start at Architecture. `/gs-project-stage-detect` reads the workspace
and tells you where you actually are — prefer it over assuming phase 1.

Gate decisions are the user's, not yours. Present what passed, what did
not, and what it costs to proceed anyway; then let them choose.
