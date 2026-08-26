# Directory scaffold

`/gs-start` creates this directory tree in the new project workspace —
this is a checklist of what to create, not a description of a layout
that already exists. Create all eight, even the ones that start empty;
later skills and rules assume they are there.

- `src/` — create for game source code: core, gameplay, ai, networking, ui, tools
- `assets/` — create for game assets: art, audio, vfx, shaders, data
- `design/` — create for game design documents: gdd, narrative, levels, balance
- `docs/` — create for technical documentation: architecture, api, postmortems; also create `docs/engine-reference/` inside it for curated, version-pinned engine API snapshots
- `tests/` — create for test suites: unit, integration, performance, playtest
- `tools/` — create for build and pipeline tools: ci, build, asset-pipeline
- `prototypes/` — create for throwaway prototypes, kept isolated from `src/`
- `production/` — create for production management: sprints, milestones, releases; also create `production/session-state/` and `production/session-logs/` inside it (both gitignored — ephemeral session state and the session audit trail)

`AGENTS.md` itself is scaffolded separately, at the workspace root, from
`AGENTS.md.template` in this same directory — it is not one of these
eight and does not live inside any of them.
