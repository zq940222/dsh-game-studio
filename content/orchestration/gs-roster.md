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
  description: "combat damage impl",
  prompt: "Read %%GS_CONTENT_DIR%%roles/gameplay-programmer.md and adopt that role.
           Also read %%GS_CONTENT_DIR%%rules/gameplay-code.md.
           Then: <the task>. Self-check against
           %%GS_CONTENT_DIR%%handbook/review-workflow.md before reporting.",
  run_in_background: false)
```

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
