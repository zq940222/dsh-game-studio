# Guards: what upstream's twelve hooks became

Upstream Claude Code ran twelve shell hooks as pre-tool-use gates. **This
harness has no pre-tool-use interception.** Nothing here can block an
action. Each hook below became a checklist, an approval prompt, or was
dropped — and knowing which matters, because a checklist you skip fails
silently where a hook would have stopped you.

| Upstream hook | What it became here | Can it block? |
|---|---|---|
| `validate-commit.sh` — hardcoded values, TODO format, JSON validity, design-doc sections | This document's commit checklist, plus the project's `AGENTS.md` rules | No |
| `validate-assets.sh` — asset naming | This document's asset checklist | No |
| `validate-push.sh` | Checklist plus the harness's own approval prompt on a push | No — approval is a human gate, not an automatic one |
| `validate-skill-change.sh` | Checklist | No |
| `detect-gaps.sh` — new-project gap detection | The `/gs-project-stage-detect` command skill | Not a gate; it reports |
| `session-start.sh`, `session-stop.sh`, `log-agent.sh`, `log-agent-stop.sh`, `notify.sh` | Dropped — the harness has its own session persistence, trajectory view, and notifications | n/a |
| `pre-compact.sh`, `post-compact.sh` | Dropped — the harness has its own compaction strategy (`/compact`) | n/a |

## Commit checklist

Before you commit, verify by hand:

1. No hardcoded values that belong in config or a data file.
2. Every `TODO` carries an owner and a ticket or issue reference.
3. Any JSON or YAML you touched parses.
4. If you changed a design decision, the design document says so.

## Asset checklist

1. File names follow the project's naming convention.
2. No asset lands outside its declared directory.
3. Large binaries are referenced, not committed, unless the project says otherwise.

## Why this is weaker than upstream, stated plainly

Upstream could refuse the commit. This document cannot. The trade was
accepted deliberately when the studio was ported: the harness's extension
points do not include tool interception, and inventing a fake gate that
only warns would be worse than an honest checklist.
