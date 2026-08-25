# Workflow Catalog

The authoritative 7-phase pipeline sequence. Read by `/gs-help` to work out where a project is and what comes next.

Phase gate verdicts (`/gs-gate-check`) are ADVISORY — they guide the decision but never hard-block advancement. The user always decides whether to proceed.

## Concept (`concept`)

Develop your game idea into a documented concept

Next phase: `systems-design`

| Step | Command | Required | Description |
|---|---|---|---|
| Brainstorm | `/gs-brainstorm` | No | Explore the game concept using MDA, verb-first, and player psychology frameworks |
| Engine Setup | `/gs-setup-engine` | Yes | Configure engine, pin version, set naming conventions and performance budgets |
| Game Concept Document | `/gs-brainstorm` | Yes | Formalize concept with pillars, MDA analysis, and scope tiers |
| Concept Review | `/gs-design-review` | No | Validate the game concept (recommended before proceeding) |
| Art Bible | `/gs-art-bible` | Yes | Author the visual identity specification (9 sections). Uses the Visual Identity Anchor produced by /gs-brainstorm. Run after game concept is formed, before systems design. |
| Systems Map | `/gs-map-systems` | Yes | Decompose concept into systems with dependency ordering and priority tiers |

## Systems Design (`systems-design`)

Author a GDD for each system in the systems index

Next phase: `technical-setup`

| Step | Command | Required | Description |
|---|---|---|---|
| System GDDs (repeatable) | `/gs-design-system` | Yes | Author per-system GDDs (guided, section-by-section). Run once per system. |
| Per-System Design Review (repeatable) | `/gs-design-review` | Yes | Validate each GDD (8 required sections, no MAJOR REVISION verdict). Run per system. |
| Cross-GDD Review | `/gs-review-all-gdds` | Yes | Holistic consistency check + design theory review across all GDDs simultaneously |
| Consistency Check (repeatable) | `/gs-consistency-check` | No | Scan all GDDs for contradictions, undefined references, and mechanic conflicts. Run after /gs-review-all-gdds, and again any time a GDD is added or revised mid-project. |

## Technical Setup (`technical-setup`)

Architecture decisions, visual identity specification, accessibility foundations, engine validation

Next phase: `pre-production`

| Step | Command | Required | Description |
|---|---|---|---|
| Architecture Document | `/gs-create-architecture` | Yes | Author the master architecture document covering all systems |
| Architecture Decisions (ADRs) (repeatable) | `/gs-architecture-decision` | Yes | Document key technical decisions as ADRs. Minimum 3 Foundation-layer ADRs required. |
| Architecture Review | `/gs-architecture-review` | Yes | Validate completeness, dependency ordering, engine compatibility |
| Control Manifest | `/gs-create-control-manifest` | Yes | Flat programmer rules sheet generated from all Accepted ADRs |
| Accessibility Requirements | — | Yes | Commit accessibility tier (Basic/Standard/Comprehensive/Exemplary) and feature matrix. UX specs (Phase 4) reference this tier. |

## Pre-Production (`pre-production`)

Visual entity inventory, UX specs, asset specs, prototype the core mechanic, define stories, validate fun

Next phase: `production`

| Step | Command | Required | Description |
|---|---|---|---|
| Visual Entity & Screen Inventory | `/gs-asset-spec` | No | Enumerate everything the game needs visually: entities (characters, enemies, buildings, environment pieces), UI screens, HUD elements, panels. Run /gs-asset-spec with no arguments to start a collaborative inventory session — brief or detailed based on your responses. Reads GDDs and art bible to propose a starting list; you add, remove, and adjust. Becomes the source of truth for all art and UX work. Not required if the game has very few distinct visual elements. |
| Asset Specs (repeatable) | `/gs-asset-spec` | No | Generate per-asset visual specifications and AI generation prompts. Run once per entity, system, level, or character. If no source doc exists, /gs-asset-spec interviews you inline — no narrative document required. |
| UX Specs (key screens) (repeatable) | `/gs-ux-design` | Yes | Author UX specs for the screens identified in the entity inventory (or GDDs if no inventory). Minimum required: main menu, core gameplay HUD, pause menu. Add more screens as the inventory identifies them. Reads input method and platform from technical-preferences.md. |
| UX Review | `/gs-ux-review` | Yes | Validate all key screen UX specs for GDD alignment and accessibility tier compliance. Run before creating epics. |
| Prototype | `/gs-prototype` | No | Build a throwaway prototype to validate the core mechanic is fun before committing to full production. Recommended for first-time mechanics or high-risk design decisions. Solo devs with proven concepts may skip. |
| Create Epics (repeatable) | `/gs-create-epics` | Yes | Translate GDDs + ADRs into epics — one per architectural module. Run per layer: /gs-create-epics layer: foundation, then /gs-create-epics layer: core |
| Create Stories (repeatable) | `/gs-create-stories` | Yes | Break each epic into implementable story files. Run per epic: /gs-create-stories [epic-slug] |
| Test Framework Setup | `/gs-test-setup` | No | Scaffold the test framework and CI pipeline once before the first sprint. Leads to /gs-test-helpers for fixture generation, /gs-qa-plan per epic, and /gs-smoke-check per sprint. |
| First Sprint Plan | `/gs-sprint-plan` | Yes | Plan the first sprint with prioritized stories from epics |
| Vertical Slice | `/gs-vertical-slice` | No | Build and playtest a vertical slice — a complete end-to-end pass through the core loop. Recommended before committing epics and stories to production. Skipping is a valid solo dev call but increases risk of late-stage design pivots. If built, must be played and documented before advancing. |

## Production (`production`)

Sprint-based feature development — pick, implement, close stories

Next phase: `polish`

| Step | Command | Required | Description |
|---|---|---|---|
| Sprint Plan (repeatable) | `/gs-sprint-plan` | Yes | Plan the current sprint with prioritized, ready stories |
| Story Readiness Check | `/gs-story-readiness` | No | Validate a story is implementation-ready before a developer picks it up |
| Implement Stories (repeatable) | `/gs-dev-story` | Yes | Pick the next ready story and implement it with /gs-dev-story [story-path]. Routes to the correct programmer agent. |
| Code Review (repeatable) | `/gs-code-review` | No | Architectural code review after each story implementation. Run after /gs-dev-story, before /gs-story-done. |
| Story Done Review (repeatable) | `/gs-story-done` | Yes | Verify all acceptance criteria, check GDD/ADR deviations, close the story |
| QA Plan (repeatable) | `/gs-qa-plan` | No | Generate a QA test plan per epic or sprint. Run /gs-qa-plan [epic-slug]. Produces test cases for /gs-smoke-check, /gs-regression-suite, and /gs-test-evidence-review. |
| Bug Report / Triage (repeatable) | `/gs-bug-report` | No | Log and prioritize bugs found during implementation. /gs-bug-report creates a structured report; /gs-bug-triage prioritizes the open backlog. |
| Sprint Retrospective (repeatable) | `/gs-retrospective` | No | Post-sprint review to capture what worked and what to change. Run at the end of each sprint, before planning the next. |
| Team Orchestration (optional) (repeatable) | — | No | Coordinate multiple agents on a complex feature. Use: /gs-team-combat, /gs-team-narrative, /gs-team-ui, /gs-team-audio, /gs-team-level, /gs-team-live-ops, /gs-team-qa. Run when a feature spans multiple agent domains. |
| Scope Check (repeatable) | `/gs-scope-check` | No | Detect scope creep by comparing current sprint scope to original epic scope. Run (a) when stories are added mid-sprint, or (b) before sprint retrospectives. |
| Sprint Status | `/gs-sprint-status` | No | Quick 30-line snapshot of sprint progress without a full report |

## Polish (`polish`)

Performance, balance, playtesting, bug fixing

Next phase: `release`

| Step | Command | Required | Description |
|---|---|---|---|
| Performance Profile | `/gs-perf-profile` | No | Profile and optimize CPU/GPU/memory bottlenecks |
| Balance Check | `/gs-balance-check` | No | Analyze game balance formulas and data for outliers and broken progressions |
| Asset Audit | `/gs-asset-audit` | No | Verify naming conventions, file format standards, and size budgets |
| Playtest Sessions (×3) | `/gs-playtest-report` | Yes | Cover: new player experience, mid-game systems, difficulty curve |
| Polish Team Pass | `/gs-team-polish` | Yes | Coordinated polish pass across performance, audio, visual, and UX |

## Release (`release`)

Launch preparation, certification, and ship

Next phase: none — this is the final phase

| Step | Command | Required | Description |
|---|---|---|---|
| Release Checklist | `/gs-release-checklist` | Yes | Pre-release validation across all departments: code, content, store, legal |
| Patch Notes | `/gs-patch-notes` | No | Generate player-facing patch notes from git history and sprint data |
| Changelog | `/gs-changelog` | No | Auto-generate internal changelog from commits, sprints, and design docs |
| Launch Checklist | `/gs-launch-checklist` | Yes | Final launch readiness — last gate before shipping to players |
