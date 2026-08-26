---
name: gs-guards
description: What upstream's twelve validation hooks became on this harness, and the checklists that replaced them. Load before committing, pushing, or shipping assets — nothing here blocks an action, so a skipped check fails silently.
---

# Guards

This harness has **no pre-tool-use interception**. Upstream ran twelve
shell hooks as gates; none of them could be ported as gates. They became
checklists, approval prompts, or were dropped.

That difference is the whole point of this skill: upstream could refuse a
bad commit, and this cannot. A check you skip here fails silently.

The full mapping, hook by hook, with the commit and asset checklists, is
at `%%GS_CONTENT_DIR%%handbook/guards.md`. Read it before you commit or
push for the first time in a project.

## The short version

- **Before a commit** — no hardcoded values, every `TODO` has an owner and
  a reference, changed JSON/YAML parses, and a changed design decision is
  written down.
- **Before a push** — the harness will ask for approval on the push itself.
  That prompt is a human gate, not an automatic one; it does not inspect
  your diff.
- **Before shipping assets** — names follow the project convention, nothing
  lands outside its declared directory.

## What this cannot do

It cannot stop you. If you want enforcement, it has to live in the
project's own CI, not in this plugin.
