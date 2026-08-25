# Agent Coordination Rules

1. **Vertical Delegation**: Leadership agents delegate to department leads, who
   delegate to specialists. Never skip a tier for complex decisions.
2. **Horizontal Consultation**: Agents at the same tier may consult each other
   but must not make binding decisions outside their domain.
3. **Conflict Resolution**: When two agents disagree, escalate to the shared
   parent. If no shared parent, escalate to `creative-director` for design
   conflicts or `technical-director` for technical conflicts.
4. **Change Propagation**: When a design change affects multiple domains, the
   `producer` agent coordinates the propagation.
5. **No Unilateral Cross-Domain Changes**: An agent must never modify files
   outside its designated directories without explicit delegation.

## Model Tier Assignment

Skills and agents carry a suggested model tier (Haiku / Sonnet / Opus) based
on task complexity. This harness has no per-skill model switch — a delegated
subagent inherits the parent session's model by default — so the tier below
is advisory: a hint for whoever decides what to run this skill under, not
something this harness enforces automatically.

- **Haiku**: read-only status checks, formatting, simple lookups — no creative judgment needed
- **Sonnet**: implementation, design authoring, analysis of individual systems — default for most work
- **Opus**: multi-document synthesis, high-stakes phase gate verdicts, cross-system holistic review

Skills with `model: haiku`: `/gs-help`, `/gs-sprint-status`, `/gs-story-readiness`, `/gs-scope-check`,
`/gs-project-stage-detect`, `/gs-changelog`, `/gs-patch-notes`, `/gs-onboard`

Skills with `model: opus`: `/gs-review-all-gdds`, `/gs-architecture-review`, `/gs-gate-check`

All other skills default to Sonnet. When creating new skills, suggest Haiku if the
skill only reads and formats; suggest Opus if it must synthesize 5+ documents with
high-stakes output; otherwise leave unset (Sonnet).

## Subagents

Spawned via this harness's subagent tool, within a single session. Used by all `team-*` skills
and orchestration skills. Subagents share the session's permission context, run
sequentially or in parallel within the session, and return results to the parent.

**When to spawn in parallel**: If two subagents' inputs are independent (neither
needs the other's output to begin), spawn both subagent calls simultaneously rather
than waiting. Example: `/gs-review-all-gdds` Phase 1 (consistency) and Phase 2
(design theory) are independent — spawn both at the same time.

## Parallel Subagent Protocol

When an orchestration skill spawns multiple independent agents:

1. Issue all independent subagent calls before waiting for any result
2. Collect all results before proceeding to dependent phases
3. If any agent is BLOCKED, surface it immediately — do not silently skip
4. Always produce a partial report if some agents complete and others block
