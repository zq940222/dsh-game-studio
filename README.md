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

## Current state: Phase 1 skeleton

This is a Phase 1 skeleton, not the full port. What is actually installed
today:

- `gs-ping` — a command skill (an install probe; reachable from the `/`
  menu, not visible to the model)
- `gs-studio` and `gs-roster` — orchestration skills (visible to the model,
  registered at runtime with this installation's absolute content path
  substituted in)
- `creative-director` — one role brief, used as the delegation-chain probe

The full port — 49 role briefs, 73 studio commands, 41 document templates,
11 coding-standard rule files, the per-engine reference handbooks, and the
guard / model-tier layers — lands in later phases. If you go looking for
`/gs-start` or a `game-designer` role brief today, they are not there yet.

## Installation

Two routes, depending on whether you want this in a profile you already use
day to day, or walled off in its own.

### Route 1: install into an existing profile (recommended)

```bash
dsh plugin --profile web add dsh-game-studio
dsh web
```

`dsh plugin` reads this package's `dsh.bundle` declaration and reconciles
it into the profile's `dsh.profile.bundles` list itself — no manual editing
of `package.json` required.

### Route 2: a dedicated, isolated profile

```bash
dsh plugin --profile game-studio add dsh-game-studio
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
| `engine` | `"auto" \| "godot" \| "unity" \| "ue5"` | `"auto"` | Substituted into the `gs-studio` orientation skill as the active engine. The per-engine reference handbooks it will eventually select between are not shipped yet (Phase 2). |
| `reviewIntensity` | `"full" \| "lean" \| "solo"` | `"full"` | Substituted into the `gs-studio` orientation skill as the active review intensity. The pipeline stages that will act on it are not shipped yet (Phase 3). |
| `watch` | `boolean` | `false` | Re-scans `content/skills/` for changes without restarting the harness. The shipped content is immutable — leave this `false` unless you are developing this plugin itself. |

These are the only configuration keys this phase implements. Other keys you
may see referenced elsewhere in the design (`exposeCommandSkillsToModel`,
`modelTiers`, `guards`) belong to later phases of this port and do not
exist in this release.

## The cost of a shared profile

Installing this into a profile you use for everyday coding is not free.
The two orchestration skills (`gs-studio`, `gs-roster`) are registered as
runtime skills and enter the model's skill catalog for **every session** on
that profile, including ordinary coding sessions that have nothing to do
with game development. They add to every session's skill listing whether
you use them or not.

The command skills (`gs-ping` today, 73 more once Phase 2 lands) do not
carry this cost — `disable-model-invocation: true` keeps them out of the
model's catalog entirely. They do still show up in the `/` menu, though;
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
