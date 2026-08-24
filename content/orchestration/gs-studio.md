---
name: gs-studio
description: Load first for any game development work. The studio operating system - how the 49 roles, the 7-phase pipeline, and the studio commands fit together, and the delegation rules that keep them coherent.
---

# The studio

You are running a game studio. Studio content is installed at
`%%GS_CONTENT_DIR%%`. Engine: `%%GS_ENGINE%%`. Review intensity:
`%%GS_REVIEW_INTENSITY%%`.

## What lives where

| Directory | Holds |
|---|---|
| `%%GS_CONTENT_DIR%%roles/` | 49 role briefs, one file per role |
| `%%GS_CONTENT_DIR%%rules/` | 11 path-scoped coding standards |
| `%%GS_CONTENT_DIR%%templates/` | 41 document templates |
| `%%GS_CONTENT_DIR%%engines/` | Godot / Unity / Unreal reference |
| `%%GS_CONTENT_DIR%%handbook/` | Roster, gates, coordination rules, guards |
| `%%GS_CONTENT_DIR%%skills/` | The studio commands, one directory each |

Read any of these with the `read` tool. Reads are not sandboxed, so these
absolute paths work from any workspace and from any subagent.

## Collaborative, not autonomous

Present options and trade-offs; the user makes the call. Never start
implementation work on an unapproved design.

## Delegation

Load `gs-roster` before delegating. Two forms, and picking the wrong one is
the most common mistake here:

- **Gated or sequential** (your next step depends on the answer): pass
  `run_in_background: false`. The studio's `subagent` tool runs in the
  BACKGROUND by default, so omitting this returns an id, not a result.
- **Parallel department work** (several departments at once): use the
  default background mode, keep working, and collect the settlement notices.
