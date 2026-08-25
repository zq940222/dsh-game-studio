# Available Skills (Slash Commands)

73 slash commands organized by phase. Type `/` to access any of them.

## Onboarding & Navigation

| Command | Purpose |
|---------|---------|
| `/gs-start` | First-time onboarding — asks where you are, then guides you to the right workflow |
| `/gs-help` | Context-aware "what do I do next?" — reads current stage and surfaces the required next step |
| `/gs-project-stage-detect` | Full project audit — detect phase, identify existence gaps, recommend next steps |
| `/gs-setup-engine` | Configure engine + version, detect knowledge gaps, populate version-aware reference docs |
| `/gs-adopt` | Brownfield format audit — checks internal structure of existing GDDs/ADRs/stories, produces migration plan |

## Game Design

| Command | Purpose |
|---------|---------|
| `/gs-brainstorm` | Guided ideation using professional studio methods (MDA, SDT, Bartle, verb-first) |
| `/gs-map-systems` | Decompose game concept into systems, map dependencies, prioritize design order |
| `/gs-design-system` | Guided, section-by-section GDD authoring for a single game system |
| `/gs-quick-design` | Lightweight design spec for small changes — tuning, tweaks, minor additions |
| `/gs-review-all-gdds` | Cross-GDD consistency and game design holism review across all design docs |
| `/gs-propagate-design-change` | When a GDD is revised, find affected ADRs and produce an impact report |

## Art & Assets

| Command | Purpose |
|---------|---------|
| `/gs-art-bible` | Guided, section-by-section Art Bible authoring — creates visual identity spec before asset production begins |
| `/gs-asset-spec` | Generate per-asset visual specifications and AI generation prompts from GDDs, level docs, or character profiles |
| `/gs-asset-audit` | Audit assets for naming conventions, file size budgets, and pipeline compliance |

## UX & Interface Design

| Command | Purpose |
|---------|---------|
| `/gs-ux-design` | Guided section-by-section UX spec authoring (screen/flow, HUD, or pattern library) |
| `/gs-ux-review` | Validate UX specs for GDD alignment, accessibility, and pattern compliance |

## Architecture

| Command | Purpose |
|---------|---------|
| `/gs-create-architecture` | Guided authoring of the master architecture document |
| `/gs-architecture-decision` | Create an Architecture Decision Record (ADR) |
| `/gs-architecture-review` | Validate all ADRs for completeness, dependency ordering, and GDD coverage |
| `/gs-create-control-manifest` | Generate flat programmer rules sheet from accepted ADRs |

## Stories & Sprints

| Command | Purpose |
|---------|---------|
| `/gs-create-epics` | Translate GDDs + ADRs into epics — one per architectural module |
| `/gs-create-stories` | Break a single epic into implementable story files |
| `/gs-dev-story` | Read a story and implement it — routes to the correct programmer agent |
| `/gs-sprint-plan` | Generate or update a sprint plan; initializes sprint-status.yaml |
| `/gs-sprint-status` | Fast 30-line sprint snapshot (reads sprint-status.yaml) |
| `/gs-story-readiness` | Validate a story is implementation-ready before pickup (READY/NEEDS WORK/BLOCKED) |
| `/gs-story-done` | 8-phase completion review after implementation; updates story file, surfaces next story |
| `/gs-estimate` | Structured effort estimate with complexity, dependencies, and risk breakdown |

## Reviews & Analysis

| Command | Purpose |
|---------|---------|
| `/gs-design-review` | Review a game design document for completeness and consistency |
| `/gs-code-review` | Architectural code review for a file or changeset |
| `/gs-balance-check` | Analyze game balance data, formulas, and config — flag outliers |
| `/gs-content-audit` | Audit GDD-specified content counts against implemented content |
| `/gs-scope-check` | Analyze feature or sprint scope against original plan, flag scope creep |
| `/gs-perf-profile` | Structured performance profiling with bottleneck identification |
| `/gs-tech-debt` | Scan, track, prioritize, and report on technical debt |
| `/gs-gate-check` | Validate readiness to advance between development phases (PASS/CONCERNS/FAIL) |
| `/gs-consistency-check` | Scan all GDDs against the entity registry to detect cross-document inconsistencies (stats, names, rules that contradict each other) |
| `/gs-security-audit` | Audit the game for security vulnerabilities: save tampering, cheat vectors, network exploits, data exposure, and input validation gaps |

## QA & Testing

| Command | Purpose |
|---------|---------|
| `/gs-qa-plan` | Generate a QA test plan for a sprint or feature |
| `/gs-smoke-check` | Run critical path smoke test gate before QA hand-off |
| `/gs-soak-test` | Generate a soak test protocol for extended play sessions |
| `/gs-regression-suite` | Map test coverage to GDD critical paths, identify fixed bugs without regression tests |
| `/gs-test-setup` | Scaffold the test framework and CI/CD pipeline for the project's engine |
| `/gs-test-helpers` | Generate engine-specific test helper libraries for the test suite |
| `/gs-test-evidence-review` | Quality review of test files and manual evidence documents |
| `/gs-test-flakiness` | Detect non-deterministic (flaky) tests from CI run logs |
| `/gs-skill-test` | Validate skill files for structural compliance and behavioral correctness |
| `/gs-skill-improve` | Improve a skill using a test-fix-retest loop — diagnose, propose fix, rewrite, verify |

## Production

| Command | Purpose |
|---------|---------|
| `/gs-milestone-review` | Review milestone progress and generate status report |
| `/gs-retrospective` | Run a structured sprint or milestone retrospective |
| `/gs-bug-report` | Create a structured bug report |
| `/gs-bug-triage` | Read all open bugs, re-evaluate priority vs. severity, assign owner and label |
| `/gs-reverse-document` | Generate design or architecture docs from existing implementation |
| `/gs-playtest-report` | Generate a structured playtest report or analyze existing playtest notes |

## Release

| Command | Purpose |
|---------|---------|
| `/gs-release-checklist` | Generate and validate a pre-release checklist for the current build |
| `/gs-launch-checklist` | Complete launch readiness validation across all departments |
| `/gs-changelog` | Auto-generate changelog from git commits and sprint data |
| `/gs-patch-notes` | Generate player-facing patch notes from git history and internal data |
| `/gs-hotfix` | Emergency fix workflow with audit trail, bypassing normal sprint process |
| `/gs-day-one-patch` | Prepare a focused day-one patch for known issues discovered after gold master but before or at public launch |

## Creative & Content

| Command | Purpose |
|---------|---------|
| `/gs-prototype` | Concept prototype — throwaway build right after brainstorm to validate core idea (Phase 1) |
| `/gs-vertical-slice` | Pre-Production validation — production-quality end-to-end build before committing to Production (Phase 4) |
| `/gs-onboard` | Generate contextual onboarding document for a new contributor or agent |
| `/gs-localize` | Localization workflow: string extraction, validation, translation readiness |

## Team Orchestration

Coordinate multiple agents on a single feature area:

| Command | Coordinates |
|---------|-------------|
| `/gs-team-combat` | game-designer + gameplay-programmer + ai-programmer + technical-artist + sound-designer + qa-tester |
| `/gs-team-narrative` | narrative-director + writer + world-builder + level-designer |
| `/gs-team-ui` | ux-designer + ui-programmer + art-director + accessibility-specialist |
| `/gs-team-release` | release-manager + qa-lead + devops-engineer + producer |
| `/gs-team-polish` | performance-analyst + technical-artist + sound-designer + qa-tester |
| `/gs-team-audio` | audio-director + sound-designer + technical-artist + gameplay-programmer |
| `/gs-team-level` | level-designer + narrative-director + world-builder + art-director + systems-designer + qa-tester |
| `/gs-team-live-ops` | live-ops-designer + economy-designer + community-manager + analytics-engineer |
| `/gs-team-qa` | qa-lead + qa-tester + gameplay-programmer + producer |
