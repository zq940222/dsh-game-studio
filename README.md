# dsh-game-studio

English | [中文](README.zh.md)

A game studio for the DeepSeek Harness: a Cordis bundle plugin that ports
the MIT-licensed
[Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
project onto DSH's skill registry and subagent delegation seam. Upstream is
a 49-role virtual studio, a 7-phase production pipeline, and a library of
studio commands, built for Claude Code's agent/skill/hook/rule extension
points. This package re-expresses that project's shape for a different
harness with a different extension surface — see `NOTICE` for the mapping.

## Capability gap

**What this cannot do.** The DeepSeek Harness has no pre-tool-use
interception, so the upstream project's 12 validation hooks could not be
ported as blocking gates. They are checklists, approval prompts, and
reminders. Nothing here will stop a bad commit — it will only tell you
about it.

## Current state: Phase 3 — orchestration and workspace scaffolding

This is the full port, not a skeleton. What is installed today:

- `gs-studio`, `gs-roster`, `gs-guards`, `gs-templates`, `gs-pipeline`, and
  the seven `gs-phase-*` phase skills — 12 orchestration skills (visible to
  the model, registered at runtime with this installation's absolute
  content path substituted in)
- 74 command skills reachable from the `/` menu, not visible to the model:
  the 73 studio commands plus `gs-ping`, this phase's own install probe
- 49 role briefs, one file per role, plus a generated `roles/_index.md`
  roster the port produces
- 40 document templates, 11 path-scoped coding-standard rule files, 46
  per-engine reference docs (Godot / Unity / Unreal), and 13 handbook
  documents (roster, gates, coordination rules, guards)
- the 7-phase pipeline guide and catalog under `pipeline/`
- `content/project/`: the `AGENTS.md` template and directory scaffold
  `/gs-start` uses to bootstrap a new project workspace — see "Workspace
  scaffolding" below

`/gs-start` and the `game-designer` role brief are both there today —
`/gs-start` now does more than route you to the next skill; see "Workspace
scaffolding" below. What is still ahead is active pipeline-stage
enforcement and the guard / model-tier layer — see Configuration below for
exactly which keys this phase implements.

## Installation

This package is not on the npm registry. Install it from the release
tarball attached to its GitHub release:

```bash
dsh plugin --profile web add https://github.com/zq940222/dsh-game-studio/releases/download/v0.2.1/dsh-game-studio-0.2.1.tgz
dsh web
```

That tarball ships `lib/` prebuilt, so the install needs no build step, no
`allowBuilds` entry, and no SSH access to GitHub. Installing from the git
URL instead (`git+https://github.com/…`) works but is markedly worse: pnpm
resolves git dependencies through `git ls-remote` over **SSH** even when
you hand it an HTTPS URL, so it fails outright on any network that blocks
port 22 or on any machine without a GitHub SSH key, and it additionally
requires an `allowBuilds` entry pinned to the exact commit SHA — which
changes on every push. Prefer the release tarball.

To upgrade later, run the same command against a newer release tag.

Below, two routes, depending on whether you want this in a profile you
already use day to day, or walled off in its own.

### Route 1: install into an existing profile (recommended)

The command above already does this. It targets the `web` profile; swap in
whichever profile name you use.

`dsh plugin` reads this package's `dsh.bundle` declaration and reconciles
it into the profile's `dsh.profile.bundles` list itself — no manual editing
of `package.json` required.

### Route 2: a dedicated, isolated profile

```bash
dsh plugin --profile game-studio add https://github.com/zq940222/dsh-game-studio/releases/download/v0.2.1/dsh-game-studio-0.2.1.tgz
```

This creates a brand-new profile. A freshly created profile is seeded with
only `["@deepseek-ai/dsh-base"]` in `dsh.profile.bundles` — there is no web
app in it. Open that profile's `package.json` and add
`"@deepseek-ai/dsh-web-app"` to `dsh.profile.bundles`, positioned after
`@deepseek-ai/dsh-base` and before `dsh-game-studio` (which the `add` command
will already have inserted). Then:

```bash
dsh --profile game-studio
```

## First use

Open a session on a profile that has this plugin installed and type `/gs`
in the input box — the command menu should show `gs-ping`. Send it: it
should report that the command skills reached the menu, quote the marker
line from its own bundled `references/probe.md`, and print the absolute
directory it loaded from.

Separately, ask the model directly — in the same session or a new one —
what skills it has available. The answer should mention `gs-studio` and
`gs-roster`, and should **not** mention `gs-ping`: command skills carry
`disable-model-invocation: true`, so they never enter the model's own skill
catalog, only the `/` menu. Load `gs-studio` next for an orientation to
what is installed and where.

## Studio panel

Installing this plugin also adds a **Game Studio** entry to the sidebar of
any profile running `dsh web`. Clicking it opens a floating panel with two
tabs:

- **Commands** — all 74 command skills, grouped into 7 pipeline phases
  (Concept, Design, Architecture, Sprint, QA, Polish, Release). Clicking a
  row runs that command immediately, in the current session — the same
  effect as typing `/name` yourself. There is no confirmation step.
- **Roles** — all 49 role briefs, grouped into 8 departments. Clicking a
  card expands it to show its five frontmatter fields (role, description,
  department, tier, suggested model tier) and its brief's content-relative
  path. The card's **Delegate task** button only **prefills** the
  composer's draft with a delegation prompt for that role — inserted
  ahead of anything you already typed, never sent for you. You still
  review it and press send yourself.

The sidebar entry is a plain DOM node inserted into the host shell's own
rendered sidebar markup — there is no plugin slot API for it (yet) — so it
self-heals across most of the shell's own re-renders, but it is watching
that markup's current shape, not a stable contract. A host restyle that
changes the sidebar's structure enough could make it stop finding
anywhere to mount, and the entry would silently disappear until a future
release of this package catches up to the new structure.

## Workspace scaffolding: `/gs-start` and `AGENTS.md`

`/gs-start` is a command skill — reachable from the `/` menu, not visible
to the model, and the harness refuses model invocation of it even if
asked by name — that onboards a new project. Beyond the upstream
onboarding questions it inherited (where are you, what should you build
first), on this harness it also bootstraps the workspace itself:

- **It asks before writing.** It shows the full plan — the directories it
  will create and the filled-in `{{PROJECT_NAME}}` / `{{ENGINE}}` /
  `{{CONTENT_DIR}}` values — and waits for approval before touching disk.
- **It creates a directory tree.** Once approved, it creates the
  top-level directories listed in `content/project/directory-scaffold.md`
  (`src/`, `assets/`, `design/`, `docs/`, `tests/`, `tools/`,
  `prototypes/`, `production/`, and their documented subdirectories) that
  do not already exist. It never deletes or overwrites an existing
  directory.
- **It writes a filled `AGENTS.md`.** It fills
  `content/project/AGENTS.md.template` — project name, engine, and this
  installation's own absolute content directory, resolved from the
  skill's own resource base rather than guessed — and writes the result
  to the workspace root as `AGENTS.md`. If one already exists, it shows
  the diff and asks before touching it.

That `AGENTS.md` is not just a file left for you to read later: this
harness injects it into every session opened in that workspace afterward,
ahead of the skill catalog, so the project's engine, content path, and
path-scoped rule table (which rule file governs which kind of edit) are
available to the model with no per-session setup. This was verified
live — a fresh session in a scaffolded workspace, with tools and file
reads disabled, correctly answered questions about the project's engine
and content path from the injection alone, at a measured cost of roughly
0.8K tokens per session.

## Configuration

Override any of these in the profile's own patch file
(`~/.dsh/profiles/<profile>/cordis.patch.yml`), targeting the `game-studio`
id this package's own `cordis.patch.yml` inserts:

```yaml
- id: game-studio
  config:
    engine: godot
    reviewIntensity: lean
```

| Key | Type | Default | What it does today |
|---|---|---|---|
| `engine` | `"auto" \| "godot" \| "unity" \| "ue5"` | `"auto"` | Substituted into the `gs-studio` orientation skill as the active engine. The per-engine reference handbooks (`content/engines/`) are shipped; automatic selection between them by this value is not wired up yet. |
| `reviewIntensity` | `"full" \| "lean" \| "solo"` | `"full"` | Substituted into `gs-studio` and all seven `gs-phase-*` pipeline stage skills. Each phase skill uses it to decide how much of its own gate is mandatory — `full` runs every check, `lean` runs the ones marked essential, `solo` runs only the deliverable check (see `gs-pipeline`). |
| `watch` | `boolean` | `false` | Re-scans `content/skills/` for changes without restarting the harness. The shipped content is immutable — leave this `false` unless you are developing this plugin itself. |
| `exposeCommandSkillsToModel` | `boolean` | `false` | Opt-in escape hatch. When `true`, all 74 command skills are *also* registered as model-invocable runtime skills, overriding their own `disable-model-invocation: true` frontmatter — on top of, not instead of, the 12 orchestration skills. This is the opposite of this package's default and measured design claim (see "The cost of a shared profile" below); leave it `false` unless you specifically want the model able to invoke studio commands directly. |

These are the only configuration keys this phase implements. Other keys you
may see referenced elsewhere in the design (`modelTiers`, `guards`) belong
to later phases of this port and do not exist in this release.

## The cost of a shared profile

Installing this into a profile you use for everyday coding is not free.
All 12 orchestration skills — `gs-studio`, `gs-roster`, `gs-guards`,
`gs-templates`, `gs-pipeline`, and the seven `gs-phase-*` phase skills —
are registered as runtime skills and enter the model's skill catalog for
**every session** on that profile, including ordinary coding sessions
that have nothing to do with game development. They add to every
session's skill listing whether you use them or not.

The command skills (74 total — the 73 studio commands plus `gs-ping`) do
not carry this cost — `disable-model-invocation: true` keeps them out of
the model's catalog entirely. They do still show up in the `/` menu, though;
type `/gs` there to filter them out of the rest of the list.

If you would rather not pay that cost on your daily-driver profile, use
Route 2 above.

## Attribution

This package is a derivative work of
[Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios),
copyright (c) 2026 Donchitos, licensed under the MIT License. The upstream
license text is reproduced verbatim in `LICENSE.upstream`; `NOTICE`
summarizes what changed in the port. This package's own code is
MIT-licensed under the terms in `LICENSE`.
