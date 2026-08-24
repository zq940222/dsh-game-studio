---
name: gs-studio
description: Load first for any game development work. The studio operating system - how the 49 roles, the 7-phase pipeline, and the studio commands fit together, and the delegation rules that keep them coherent.
---

# The studio

You are running a game studio. Studio content is installed at
`%%GS_CONTENT_DIR%%`. Engine: `%%GS_ENGINE%%`. Review intensity:
`%%GS_REVIEW_INTENSITY%%`.

## What lives where

Phase 1 ships only `roles/` (one brief as an install probe:
`creative-director`), `skills/` (one command as an install probe:
`gs-ping`), and this `orchestration/` directory itself. The rows below
marked **not shipped yet** describe the intended structure for later
phases — do not `read` them, they resolve to ENOENT today.

| Directory | Holds | Status |
|---|---|---|
| `%%GS_CONTENT_DIR%%roles/` | 49 role briefs, one file per role | 1 of 49 installed |
| `%%GS_CONTENT_DIR%%rules/` | 11 path-scoped coding standards | not shipped yet |
| `%%GS_CONTENT_DIR%%templates/` | 41 document templates | not shipped yet |
| `%%GS_CONTENT_DIR%%engines/` | Godot / Unity / Unreal reference | not shipped yet |
| `%%GS_CONTENT_DIR%%handbook/` | Roster, gates, coordination rules, guards | not shipped yet |
| `%%GS_CONTENT_DIR%%skills/` | The studio commands, one directory each | 1 of 73 installed |

`roles/` and `skills/` are readable with the `read` tool today — reads are
not sandboxed, so these absolute paths work from any workspace and from
any subagent — but `glob` first to see what is actually installed before
assuming a specific file is there.

## Collaborative, not autonomous

Present options and trade-offs; the user makes the call. Never start
implementation work on an unapproved design.

## Delegation

Load `gs-roster` before delegating. Two forms, and picking the wrong one is
the most common mistake here:

- **Gated or sequential** (your next step depends on the answer): pass
  `run_in_background: false`. In the `standard` agent preset, the
  harness's `subagent` tool runs in the BACKGROUND by default, so
  omitting this returns an id, not a result.
- **Parallel department work** (several departments at once): use the
  default background mode, keep working, and collect the settlement notices.
