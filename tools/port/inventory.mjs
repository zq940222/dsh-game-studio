/**
 * Whitelists and inventory constants the port transformer keys off.
 * Every list here is the ground truth a rule consults before rewriting —
 * the `/cmd` rewrite in particular is whitelist-driven precisely because
 * the upstream body carries 997 slash-shaped strings, most of which are
 * paths and ratios rather than commands.
 *
 * @module tools/port/inventory
 */

/** The upstream commit this port reproduces from. */
export const UPSTREAM_SHA = "984023d";

/** The 73 upstream command names, from `.claude/skills/<name>/SKILL.md`. */
export const COMMANDS = Object.freeze([
  "adopt", "architecture-decision", "architecture-review", "art-bible",
  "asset-audit", "asset-spec", "balance-check", "brainstorm", "bug-report",
  "bug-triage", "changelog", "code-review", "consistency-check",
  "content-audit", "create-architecture", "create-control-manifest",
  "create-epics", "create-stories", "day-one-patch", "design-review",
  "design-system", "dev-story", "estimate", "gate-check", "help", "hotfix",
  "launch-checklist", "localize", "map-systems", "milestone-review",
  "onboard", "patch-notes", "perf-profile", "playtest-report",
  "project-stage-detect", "propagate-design-change", "prototype", "qa-plan",
  "quick-design", "regression-suite", "release-checklist", "retrospective",
  "reverse-document", "review-all-gdds", "scope-check", "security-audit",
  "setup-engine", "skill-improve", "skill-test", "smoke-check", "soak-test",
  "sprint-plan", "sprint-status", "start", "story-done", "story-readiness",
  "team-audio", "team-combat", "team-level", "team-live-ops",
  "team-narrative", "team-polish", "team-qa", "team-release", "team-ui",
  "tech-debt", "test-evidence-review", "test-flakiness", "test-helpers",
  "test-setup", "ux-design", "ux-review", "vertical-slice",
]);

const DIRECTORS = ["creative-director", "technical-director", "producer"];
const LEADS = [
  "game-designer", "lead-programmer", "art-director", "audio-director",
  "narrative-director", "qa-lead", "release-manager", "localization-lead",
];
const SPECIALISTS = [
  "accessibility-specialist", "ai-programmer", "analytics-engineer",
  "community-manager", "devops-engineer", "economy-designer",
  "engine-programmer", "gameplay-programmer", "godot-csharp-specialist",
  "godot-gdextension-specialist", "godot-gdscript-specialist",
  "godot-shader-specialist", "godot-specialist", "level-designer",
  "live-ops-designer", "network-programmer", "performance-analyst",
  "prototyper", "qa-tester", "security-engineer", "sound-designer",
  "systems-designer", "technical-artist", "tools-programmer",
  "ue-blueprint-specialist", "ue-gas-specialist", "ue-replication-specialist",
  "ue-umg-specialist", "ui-programmer", "unity-addressables-specialist",
  "unity-dots-specialist", "unity-shader-specialist", "unity-specialist",
  "unity-ui-specialist", "unreal-specialist", "ux-designer", "world-builder",
  "writer",
];

/** Department a role reports through, used for the role brief's frontmatter. */
function departmentOf(name) {
  if (DIRECTORS.includes(name)) return "leadership";
  if (name.includes("programmer") || name.includes("engineer") || name.endsWith("-specialist")) return "engineering";
  if (name.includes("audio") || name.includes("sound")) return "audio";
  if (name.includes("art")) return "art";
  if (name.includes("design")) return "design";
  if (name.includes("qa") || name.includes("test")) return "qa";
  if (name.includes("narrative") || name === "writer") return "narrative";
  return "production";
}

/** The 49 role briefs, with the delegation tier each one sits at. */
export const ROLES = Object.freeze(Object.fromEntries([
  ...DIRECTORS.map((n) => [n, Object.freeze({ tier: 1, department: departmentOf(n) })]),
  ...LEADS.map((n) => [n, Object.freeze({ tier: 2, department: departmentOf(n) })]),
  ...SPECIALISTS.map((n) => [n, Object.freeze({ tier: 3, department: departmentOf(n) })]),
]));

/**
 * Documents that describe Claude Code's own extension points and have no
 * DeepSeek Harness meaning. Rewriting them would produce plausible-looking
 * instructions for machinery that does not exist, which is worse than
 * omitting them. Recorded in NOTICE and the port manifest.
 */
export const EXCLUDED_DOCS = Object.freeze([
  "CLAUDE-local-template.md",
  "settings-local-template.md",
  "hooks-reference.md",
  "hooks-reference/hook-input-schemas.md",
  "hooks-reference/post-merge-asset-validation.md",
  "hooks-reference/post-sprint-retrospective.md",
  "hooks-reference/pre-commit-code-quality.md",
  "hooks-reference/pre-commit-design-check.md",
  "hooks-reference/pre-push-test-gate.md",
]);

const COMMAND_SET = new Set(COMMANDS);
const ROLE_SET = new Set(Object.keys(ROLES));

/** Exact membership — never a substring or prefix match. */
export function isCommand(name) {
  return COMMAND_SET.has(name);
}

/** Exact membership — never a substring or prefix match. */
export function isRole(name) {
  return ROLE_SET.has(name);
}
