---
name: gs-roster
description: The 49 studio roles and the delegation protocol. Load before delegating any work to a subagent, to pick the right role and hand it its brief.
---

# Roster and delegation protocol

Role briefs live at `%%GS_CONTENT_DIR%%roles/<role>.md`.

## How to delegate

Do NOT paste a role brief into the child's prompt — that spends your own
context on it. Tell the child to read its own brief:

```
subagent(
  description: "pillar tradeoff review",
  prompt: "Read %%GS_CONTENT_DIR%%roles/creative-director.md and adopt
           that role. Then: <the task>.",
  run_in_background: false)
```

In the `standard` agent preset, the harness's `subagent` tool runs in the
BACKGROUND by default and returns an id rather than a result, so there are
two forms, and picking the wrong one is the most common mistake here:

- **Gated or sequential** (your next step depends on the answer, as in
  the example above — e.g. a department lead's review must pass before
  the next stage starts): pass `run_in_background: false` explicitly and
  wait for the result.
- **Parallel department work** (several departments at once, e.g.
  combat, UI, and audio in the same breath): use the default background
  mode, keep working on other things, and collect each settlement notice
  as it lands rather than serializing every department.

## Tiers

Delegation depth carries the hierarchy, and the cap is 3:

| Tier | Depth | Who |
|---|---|---|
| 1 Directors | you, depth 0 | creative-director, technical-director, producer |
| 2 Department leads | depth 1 | game-designer, lead-programmer, art-director, audio-director, narrative-director, qa-lead, release-manager, localization-lead |
| 3 Specialists | depth 2 | the remaining 38 role briefs |

A Tier-3 specialist cannot delegate further. Keep the chain at three.

## Available roles

Phase 1 ships one brief as an install probe: `creative-director`. List
`%%GS_CONTENT_DIR%%roles/` with `glob` to see what is installed.
