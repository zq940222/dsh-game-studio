#!/usr/bin/env node
/**
 * Transform an upstream snapshot into `content/`.
 *
 * Usage: node tools/port/port.mjs <snapshot-root>
 *
 * Every rule is applied by destination, because a marker that is correct in
 * an orchestration file is a silent failure in a command skill. This is the
 * only module in `tools/port/` that does I/O — `inventory.mjs` and
 * `rules.mjs` are pure, so every rewrite they perform is fixture-tested in
 * isolation; this file's job is reading the snapshot, dispatching each file
 * to the right destination, writing `content/`, and running the gates.
 *
 * Idempotent: re-running clears every directory this script owns
 * (`roles/`, `templates/`, `rules/`, `engines/`, `handbook/`, `pipeline/`,
 * and `skills/gs-*` except `gs-ping`) before writing, and never touches
 * `content/orchestration/` or `content/skills/gs-ping/` — both are Phase 1's.
 *
 * @module tools/port/port
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { EXCLUDED_DOCS, UPSTREAM_SHA } from "./inventory.mjs";
import {
  DEST, appendRoutingLine, countCommandHits, findBashSites, resolveDepthPrefix, rewriteClaudeCodeMentionsCounted,
  rewriteClaudeMd, rewriteClaudeMdCounted, rewriteCommands, rewriteDelegationCounted, rewritePathsCounted,
  rewriteStructuredToolsCounted, rewriteUnconditionalTools, rewriteUnconditionalToolsCounted,
  transformRoleFrontmatter, transformSkillFrontmatter,
} from "./rules.mjs";
import { checkCounts, checkMarkerLeaks, checkReferentialIntegrity, renderManifest } from "./manifest.mjs";

const snapshot = process.argv[2];
if (!snapshot) {
  console.error("usage: port.mjs <snapshot-root>");
  process.exit(2);
}

// Validate the snapshot BEFORE clearOwned() runs. clearOwned() wipes every
// directory this script owns; if that ran first and the snapshot turned out
// to be missing or incomplete, a typo'd argument would gut the working tree
// (everything it owns, not just skills) and then die on the first
// readFileSync with a raw ENOENT and no explanation of what happened or why.
// gs-ping and orchestration/ would still be safe (clearOwned never touches
// them) and a correct re-run regenerates everything else, but Task 14 is
// about to commit this output, so failing before touching disk matters.
//
// All SIX source roots the port reads from are checked here, not just
// skills/ — a snapshot containing only `.claude/skills/` used to pass this
// guard, only for clearOwned() to wipe every other owned directory and the
// run to then die on a raw ENOENT for `.claude/agents`, leaving a gutted
// tree with a message that claimed the snapshot was validated. These six
// literals must stay in sync with the six `*SrcDir` reads below.
const SOURCE_ROOTS = [
  ".claude/skills",
  ".claude/agents",
  ".claude/docs/templates",
  ".claude/rules",
  ".claude/docs",
  "docs/engine-reference",
];
const missingRoots = SOURCE_ROOTS.map((rel) => join(snapshot, rel)).filter((abs) => !existsSync(abs));
if (missingRoots.length > 0) {
  console.error(`port: snapshot not found or incomplete — missing:`);
  for (const m of missingRoots) console.error(`  ${m}`);
  process.exit(2);
}

// Phase 1 established this pattern on Windows: fileURLToPath, not
// `.pathname` plus a drive-letter regex hack.
const OUT = fileURLToPath(new URL("../../content/", import.meta.url));
const MANIFEST_PATH = fileURLToPath(new URL("./manifest.md", import.meta.url));

// Every rule the port applies, R1-R14, so the manifest's rule-hit table
// never silently omits one — the review-round finding this fixes was
// exactly that a human cross-checking against spec §5's site counts had no
// row to check some rules against at all. R3, R9, R10, R11, R12, and R13
// are filled in once their own counters are known (see where each is set
// below); their zero here is a placeholder, not a claim of zero sites.
const ruleHits = {
  R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, "R6/R8": 0, R7: 0,
  R9: "folded into R6/R8 — see rewritePaths' doc comment", R10: 0, R11: 0,
  R12: "structural invariant, not a text rewrite — see the skill-loop's name≡dir comment", R13: 0, R14: 0,
};
const bashSites = [];
const written = [];

// ---------------------------------------------------------------------------
// Idempotence: clear only what this script owns.
// ---------------------------------------------------------------------------

/**
 * Clear every directory the port owns before writing, so a rule fix and a
 * re-run cannot leave a stale file behind. The directory names are literal
 * constants joined onto the fixed OUT root — never built from snapshot
 * content or CLI input — so this cannot be redirected into
 * `content/orchestration/` or `content/skills/gs-ping/` by a malformed path;
 * those two are simply never named here.
 */
function clearOwned() {
  for (const dir of ["roles", "templates", "rules", "engines", "handbook", "pipeline"]) {
    rmSync(join(OUT, dir), { recursive: true, force: true });
  }
  const skillsDir = join(OUT, "skills");
  if (!existsSync(skillsDir)) return;
  for (const entry of readdirSync(skillsDir)) {
    if (entry === "gs-ping") continue; // Phase 1's first-party probe: never touched.
    if (!entry.startsWith("gs-")) continue; // not ours to clear.
    rmSync(join(skillsDir, entry), { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Small local helpers.
// ---------------------------------------------------------------------------

/** Split a file's raw text into `[rawFrontmatter, body]`, fences excluded. */
function splitFm(t) {
  if (!t.startsWith("---")) return ["", t];
  const e = t.indexOf("\n---", 3);
  return e === -1 ? ["", t] : [t.slice(t.indexOf("\n") + 1, e + 1), t.slice(e + 4).replace(/^\r?\n/, "")];
}

/**
 * Record every `Bash` site found in a file's ORIGINAL text, before any body
 * rewrite runs. Two thirds of R1's changed lines land on other tokens in
 * the same line, so scanning post-rewrite text would misreport a site's own
 * location — findBashSites must see the file exactly as upstream wrote it.
 *
 * `lineDelta` corrects a DIFFERENT problem than the one above: for skills
 * and roles, `rawText`'s line numbers are relative to the UPSTREAM
 * frontmatter's line count, but the shipped file's frontmatter is
 * REGENERATED (transformSkillFrontmatter/transformRoleFrontmatter re-key
 * everything through `yaml.stringify`, dropping some fields and adding
 * others), which almost never has the same line count as the original. A
 * body-relative line number is invariant either way, so the delta between
 * the two frontmatter blocks' line counts, added once, is exactly the
 * correction — see the two call sites for the actual computation. Every
 * other file this is called for has no regenerated frontmatter, hence the
 * default of 0.
 * @param rawText - the file's untouched, as-read text.
 * @param outPath - the content/-relative path this file will be written to.
 * @param lineDelta - added to every site's reported line number.
 */
function recordBashSites(rawText, outPath, lineDelta = 0) {
  for (const s of findBashSites(rawText)) bashSites.push({ file: outPath, ...s, line: s.line + lineDelta });
}

/**
 * `.claude/docs/workflow-catalog.yaml` is converted to Markdown and moved to
 * `content/pipeline/workflow-catalog.md` — a relocation the shared PATH_MAP
 * cannot express, since it changes both the destination bucket AND the file
 * extension. THREE real corpus sites name it, only two of which this literal
 * pass rewrites:
 *   - `.claude/skills/help/SKILL.md` and `docs/WORKFLOW-GUIDE.md` itself name
 *     it by the full upstream path `.claude/docs/workflow-catalog.yaml` —
 *     path-shaped and unambiguous, so rewritten here.
 *   - `.claude/docs/quick-start.md` names it by BARE FILENAME
 *     (`workflow-catalog.yaml`, inside an ASCII directory-tree listing), with
 *     no path prefix to match on. Deliberately left alone: matching a bare
 *     filename risks false-positiving on unrelated prose, and the whole
 *     tree diagram it sits in is replaced wholesale by
 *     {@link fixupClaudeDocResidue} below anyway.
 *
 * Uses {@link resolveDepthPrefix} — the same lookup rewritePaths uses —
 * rather than a second hand-rolled copy, so an unrecognized `dest` fails
 * loudly here too instead of silently reintroducing the "../../" fallback
 * rewritePaths was already changed to reject, and so this reference gets the
 * same per-file derived depth rewritePaths does rather than a bucket
 * constant that can be wrong for a DOC_NESTED file three levels deep.
 *
 * Fixed up here, before rewritePaths runs, so the generic
 * `.claude/docs/` -> `handbook/` mapping never sees the literal string and
 * cannot misroute it to a file that was never written there.
 * @param text - text being rewritten for one destination.
 * @param dest - one of {@link DEST}; picks the depth prefix.
 * @param outPath - optional; see {@link resolveDepthPrefix}.
 * @returns text with the reference redirected, unchanged if absent.
 */
const PIPELINE_YAML_REF = ".claude/docs/workflow-catalog.yaml";
function fixupPipelineRefs(text, dest, outPath) {
  if (!text.includes(PIPELINE_YAML_REF)) return text;
  const prefix = resolveDepthPrefix(dest, outPath);
  return text.split(PIPELINE_YAML_REF).join(`${prefix}pipeline/workflow-catalog.md`);
}

/**
 * Literal overrides for the files that keep their content but contain
 * Claude-Code-specific forms no generic rule can safely reach: a bare
 * `.claude/` naming no specific subpath, prose describing hook/settings
 * machinery this harness does not have, a table of literal Anthropic model
 * IDs, a whole "Agent Teams" subsection with no analog here, or a one-off
 * brand mention that only the surrounding sentence's grammar can fix
 * correctly. Each is an enumerated, auditable literal replacement, keyed by
 * the file's ported name (a skill's bare `gs-<name>`, or a handbook/pipeline
 * doc's bare filename) and applied to the RAW upstream text before any
 * other rule runs — including {@link rewriteClaudeCodeMentions} (R14) and
 * the delegation-idiom entries in {@link rewriteStructuredTools} (R2), both
 * of which still run over whatever this function returns. Several blocks
 * below deliberately leave a "Claude Code session" or "Task calls" phrase
 * unfixed for exactly that reason — fixing it here too would just be a
 * second copy of the same substitution to keep in sync with R14/R2.
 * Absent files and absent literals are both no-ops — `.split/.join` on a
 * missing literal returns the input unchanged — so this never throws on a
 * file it does not own.
 *
 * G3 is not loosened for any of these: the fix is that the content stops
 * containing the strings, not that the gate stops checking for them.
 * @param text - the file's raw, unmodified upstream text.
 * @param outName - the ported file's bare name, e.g. `"quick-start.md"` or `"gs-start"`.
 * @returns text with this file's literal overrides applied, unchanged if
 *   `outName` names none of the files this function knows about.
 */
function fixupClaudeDocResidue(text, outName) {
  if (outName === "directory-structure.md") {
    // The other 17 lines are the GAME PROJECT's own layout (src/, assets/,
    // design/, docs/, tests/, tools/, prototypes/, production/) — exactly
    // what /gs-start scaffolds — and are worth keeping verbatim. Only this
    // one line named the Claude Code extension-point directory; the
    // studio's roles/commands/rules/docs ship inside the plugin instead, so
    // there is no project-relative directory to rename it to.
    return text.split(
      "├── .claude/                     # Agent definitions, skills, hooks, rules, docs",
    ).join(
      "├── (studio roles, commands, and rules ship inside the dsh-game-studio plugin, not this project)",
    );
  }
  if (outName === "quick-start.md") {
    let out = text.split(
      "This is a complete Claude Code agent architecture for game development. It",
    ).join(
      "This is a complete game-studio role and command architecture for game development, ported onto the DeepSeek Harness. It",
    );
    // The "## File Structure Reference" tree: everything from the bare
    // `.claude/` line down is Claude Code's own settings.json/hooks/YAML-
    // frontmatter storage format for the subtree that heading introduces —
    // once the heading line is gone the indented entries beneath it have no
    // parent to hang off, so the whole subtree is replaced as one block
    // rather than patching the bare `.claude/` line in isolation.
    out = out.split([
      "CLAUDE.md                          -- Master config (read this first, ~60 lines)",
      ".claude/",
      "  settings.json                    -- Claude Code hooks and project settings",
      "  agents/                          -- 49 agent definitions (YAML frontmatter)",
      "  skills/                          -- 73 slash command definitions (YAML frontmatter)",
      "  hooks/                           -- 12 hook scripts (.sh) wired by settings.json",
      "  rules/                           -- 11 path-specific rule files",
      "  docs/",
      "    quick-start.md                 -- This file",
      "    technical-preferences.md       -- Project-specific standards (populated by /setup-engine)",
      "    coding-standards.md            -- Coding and design doc standards",
      "    coordination-rules.md          -- Agent coordination rules",
      "    context-management.md          -- Context budgets and compaction instructions",
      "    directory-structure.md         -- Project directory layout",
      "    workflow-catalog.yaml          -- 7-phase pipeline definition (read by /help)",
      "    setup-requirements.md          -- System prerequisites (Git Bash, jq, Python)",
      "    settings-local-template.md     -- Personal settings.local.json guide",
      "    templates/                     -- 41 document templates",
      "```",
    ].join("\n")).join([
      "AGENTS.md                          -- Workspace instructions (read this first)",
      "```",
      "",
      "Studio roles, commands, rule files, and reference docs ship inside the",
      "`dsh-game-studio` plugin itself, not as project files — see",
      "`directory-structure.md` for this project's own scaffolded layout.",
    ].join("\n"));
    return out;
  }
  if (outName === "workflow-guide.md") {
    let out = text;
    // Title + opening blurb: names the upstream project and frames "12
    // automated hooks" and "Claude Code installed" as active prerequisites.
    // Fixed first, before the other four blocks below, purely because it is
    // the file's first lines — order has no effect on correctness since none
    // of these six blocks overlap.
    out = out.split([
      "# Claude Code Game Studios -- Complete Workflow Guide",
      "",
      "> **How to go from zero to a shipped game using the Agent Architecture.**",
      ">",
      "> This guide walks you through every phase of game development using the",
      "> 49-agent system, 73 slash commands, and 12 automated hooks. It assumes you",
      "> have Claude Code installed and are working from the project root.",
      ">",
      "> The pipeline has 7 phases. Each phase has a formal gate (`/gate-check`)",
      "> that must pass before you advance. The authoritative phase sequence is",
      "> defined in `.claude/docs/workflow-catalog.yaml` and read by `/help`.",
    ].join("\n")).join([
      "# Game Studio -- Complete Workflow Guide",
      "",
      "> **How to go from zero to a shipped game using the Agent Architecture.**",
      ">",
      "> This guide walks you through every phase of game development using the",
      "> 49-agent system, 73 slash commands, and a set of coordination checklists",
      "> (see `NOTICE` for what upstream's 12 automated hooks became on this",
      "> harness). It assumes you are working from the project root.",
      ">",
      "> The pipeline has 7 phases. Each phase has a formal gate (`/gate-check`)",
      "> that must pass before you advance. The authoritative phase sequence is",
      "> defined in `.claude/docs/workflow-catalog.yaml` and read by `/help`.",
    ].join("\n"));
    // Prerequisites: "Claude Code installed" is not a prerequisite to state
    // (you cannot be reading this without the harness already running), and
    // jq/Python are cited only because upstream's shell hooks needed them —
    // hooks that do not execute here, so the reason for the requirement is
    // gone along with the requirement itself. Git remains a real
    // prerequisite regardless of harness.
    out = out.split([
      "Before you start, make sure you have:",
      "",
      "- **Claude Code** installed and working",
      "- **Git** with Git Bash (Windows) or standard terminal (Mac/Linux)",
      "- **jq** (optional but recommended -- hooks fall back to `grep` if missing)",
      "- **Python 3** (optional -- some hooks use it for JSON validation)",
    ].join("\n")).join([
      "Before you start, make sure you have:",
      "",
      "- **Git** with Git Bash (Windows) or standard terminal (Mac/Linux)",
    ].join("\n"));
    // "Verify Hooks Are Working" describes machinery this harness does not
    // have (pre-tool-use interception) as if it runs today; redirect to
    // NOTICE's hook-degradation statement instead of describing a gate that
    // does not exist.
    out = out.split([
      "### Step 3: Verify Hooks Are Working",
      "",
      "Start a new Claude Code session. You should see output from the",
      "`session-start.sh` hook:",
      "",
      "```",
      "=== Claude Code Game Studios -- Session Context ===",
      "Branch: main",
      "Recent commits:",
      "  abc1234 Initial commit",
      "===================================",
      "```",
      "",
      "If you see this, hooks are working. If not, check `.claude/settings.json` to",
      "make sure the hook paths are correct for your OS.",
    ].join("\n")).join([
      "### Step 3: Understand the Guardrails",
      "",
      "This harness has no pre-tool-use interception, so the upstream project's",
      "validation hooks are not wired as executable gates here — see `NOTICE`",
      "for the full mapping. What ships instead are checklists, approval",
      "prompts, and reminders threaded through the command skills; nothing",
      "here will stop a bad commit automatically.",
    ].join("\n"));
    // "Automated Hooks (Safety Net)" lists the 12 upstream shell hooks as a
    // safety net that runs automatically. Same redirection: point at NOTICE
    // rather than describing 12 executable gates that do not exist here.
    out = out.split([
      "### Automated Hooks (Safety Net)",
      "",
      "The system has 12 hooks that run automatically:",
      "",
      "| Hook | Trigger | What It Does |",
      "|------|---------|-------------|",
      "| `session-start.sh` | Session start | Shows branch, recent commits, detects active.md for recovery |",
      "| `detect-gaps.sh` | Session start | Detects fresh projects (no engine, no concept) and suggests `/start` |",
      "| `pre-compact.sh` | Before compaction | Dumps session state into conversation for auto-recovery |",
      "| `post-compact.sh` | After compaction | Reminds Claude to restore session state from `active.md` |",
      "| `notify.sh` | Notification event | Shows Windows toast notification via PowerShell |",
      "| `validate-commit.sh` | Before commit | Checks for design doc references, valid JSON, no hardcoded values |",
      "| `validate-push.sh` | Before push | Warns on pushes to main/develop |",
      "| `validate-assets.sh` | Before commit | Checks asset naming and size |",
      "| `validate-skill-change.sh` | Skill file written | Advises running `/skill-test` after `.claude/skills/` changes |",
      "| `log-agent.sh` | Agent start | Logs agent invocations for audit trail |",
      "| `log-agent-stop.sh` | Agent stop | Completes agent audit trail (start + stop) |",
      "| `session-stop.sh` | Session end | Final session logging |",
    ].join("\n")).join([
      "### Automated Hooks (Safety Net)",
      "",
      "Upstream ran this as 12 automated shell hooks (session start/stop,",
      "pre/post compaction, commit and push validation, agent-start logging,",
      "and more). This harness has no pre-tool-use interception to wire them",
      "into — see `NOTICE` for the full mapping. Equivalent coverage, where",
      "it exists at all, comes from checklists and reminders in the command",
      "skills themselves; none of it can block an action.",
    ].join("\n"));
    // Step 7.5 (Ship): "the `validate-push` hook will warn you" describes
    // an active enforcement mechanism — the file already says, eighteen
    // lines above the Automated Hooks block, that no such mechanism exists.
    out = out.split([
      "The `validate-push` hook will warn you when pushing to `main` or `develop`.",
      "This is intentional -- release pushes should be deliberate:",
    ].join("\n")).join([
      "There is no automatic push guard here (see `NOTICE`) — treat pushes to",
      "`main` or `develop` as deliberate, considered actions:",
    ].join("\n"));
    // "Automatic recovery" (Context Resilience): same contradiction —
    // session-start/pre-compact hooks described as running automatically.
    out = out.split([
      "**Automatic recovery:** The `session-start.sh` hook detects and previews",
      "`active.md` automatically. The `pre-compact.sh` hook dumps state into the",
      "conversation before compaction.",
    ].join("\n")).join([
      "**Recovery, done by hand:** There is no session-start or pre-compact hook",
      "here (see `NOTICE`) — open and read `active.md` yourself at the start of a",
      "session, and write your state to it yourself before compacting.",
    ].join("\n"));
    // Review-round finding (Important 5): same `/clear` defect as
    // context-management.md's identical sentence — see that fixup block's
    // comment. Matched here across the line wrap the raw upstream source
    // uses.
    out = out.split([
      "checkpoint. Update it after each significant milestone. After any disruption",
      "(compaction, crash, `/clear`), read this file first.",
    ].join("\n")).join([
      "checkpoint. Update it after each significant milestone. After any disruption",
      "(compaction, crash, or starting a new session), read this file first.",
    ].join("\n"));
    // "Compact proactively" (Final Reminders): same contradiction again,
    // for the pre-compact hook specifically.
    out = out.split([
      "4. **Compact proactively.** At ~65-70% context usage, compact or `/clear`.",
      "   The pre-compact hook saves your progress. Do not wait until you are at the",
      "   limit.",
    ].join("\n")).join([
      // Review-round finding (Important 5): the TO string had carried
      // "compact or `/clear`" through unfixed — `/clear` names a Claude
      // Code builtin this harness does not have (inventory.mjs already
      // classifies it as one); the FROM string above keeps it, matching
      // upstream, but the replacement must not.
      "4. **Compact proactively.** At ~65-70% context usage, run `/compact`.",
      "   There is no pre-compact hook to save your progress automatically (see",
      "   `NOTICE`) — write it to file yourself. Do not wait until you are at the",
      "   limit.",
    ].join("\n"));
    return out;
  }
  if (outName === "coordination-rules.md") {
    // One block covering three separate problems in adjacent sections,
    // excised/rewritten together because the Agent Teams subsection sits
    // between the two others and leaving it in place mid-edit would orphan
    // its heading. Exact block boundaries (raw upstream line numbers):
    //   - Lines 15-33 "## Model Tier Assignment": the tier table assigns
    //     literal Anthropic model IDs, actively wrong for this harness.
    //     Phase 1's design is that a delegated subagent inherits the
    //     parent's model by default and tier is advisory — say that.
    //   - Lines 34-47 "### Subagents (current, always active)": kept and
    //     lightly fixed (the backtick-wrapped "via `Task`" the generic
    //     TASK_DELEGATION_PHRASES regexes cannot reach, since `\s+` does
    //     not cross a backtick). "Claude Code session" and "Task calls" in
    //     this same block are deliberately left as-is — rewriteClaudeCodeMentions
    //     (R14) and rewriteStructuredTools (R2) run on this text afterward
    //     and rewrite both correctly; duplicating that here would just be a
    //     second copy of the same substitution to keep in sync.
    //   - Lines 48-64 "### Agent Teams (experimental — opt-in)": excised
    //     entirely — Claude Code machinery with no analog here, gated on an
    //     env var this harness never reads.
    //   - Line 66 "## Parallel Task Protocol": heading renamed; its body
    //     (line 70's "Task calls") is left for R2 to catch, same reasoning
    //     as above.
    return text.split([
      "## Model Tier Assignment",
      "",
      "Skills and agents are assigned to model tiers based on task complexity:",
      "",
      "| Tier | Model | When to use |",
      "|------|-------|-------------|",
      "| **Haiku** | `claude-haiku-4-5-20251001` | Read-only status checks, formatting, simple lookups — no creative judgment needed |",
      "| **Sonnet** | `claude-sonnet-4-6` | Implementation, design authoring, analysis of individual systems — default for most work |",
      "| **Opus** | `claude-opus-4-6` | Multi-document synthesis, high-stakes phase gate verdicts, cross-system holistic review |",
      "",
      "Skills with `model: haiku`: `/help`, `/sprint-status`, `/story-readiness`, `/scope-check`,",
      "`/project-stage-detect`, `/changelog`, `/patch-notes`, `/onboard`",
      "",
      "Skills with `model: opus`: `/review-all-gdds`, `/architecture-review`, `/gate-check`",
      "",
      "All other skills default to Sonnet. When creating new skills, assign Haiku if the",
      "skill only reads and formats; assign Opus if it must synthesize 5+ documents with",
      "high-stakes output; otherwise leave unset (Sonnet).",
      "",
      "## Subagents vs Agent Teams",
      "",
      "This project uses two distinct multi-agent patterns:",
      "",
      "### Subagents (current, always active)",
      "Spawned via `Task` within a single Claude Code session. Used by all `team-*` skills",
      "and orchestration skills. Subagents share the session's permission context, run",
      "sequentially or in parallel within the session, and return results to the parent.",
      "",
      "**When to spawn in parallel**: If two subagents' inputs are independent (neither",
      "needs the other's output to begin), spawn both Task calls simultaneously rather",
      "than waiting. Example: `/review-all-gdds` Phase 1 (consistency) and Phase 2",
      "(design theory) are independent — spawn both at the same time.",
      "",
      "### Agent Teams (experimental — opt-in)",
      "Multiple independent Claude Code *sessions* running simultaneously, coordinated",
      "via a shared task list. Each session has its own context window and token budget.",
      "Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable.",
      "",
      "**Use agent teams when**:",
      "- Work spans multiple subsystems that will not touch the same files",
      "- Each workstream would take >30 minutes and benefits from true parallelism",
      "- A senior agent (technical-director, producer) needs to coordinate 3+ specialist",
      "  sessions working on different epics simultaneously",
      "",
      "**Do not use agent teams when**:",
      "- One session's output is required as input for another (use sequential subagents)",
      "- The task fits in a single session's context (use subagents instead)",
      "- Cost is a concern — each team member burns tokens independently",
      "",
      "**Current status**: Opt-in via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Document first usage here when adopted.",
      "",
      "## Parallel Task Protocol",
    ].join("\n")).join([
      "## Model Tier Assignment",
      "",
      "Skills and agents carry a suggested model tier (Haiku / Sonnet / Opus) based",
      "on task complexity. This harness has no per-skill model switch — a delegated",
      "subagent inherits the parent session's model by default — so the tier below",
      "is advisory: a hint for whoever decides what to run this skill under, not",
      "something this harness enforces automatically.",
      "",
      "- **Haiku**: read-only status checks, formatting, simple lookups — no creative judgment needed",
      "- **Sonnet**: implementation, design authoring, analysis of individual systems — default for most work",
      "- **Opus**: multi-document synthesis, high-stakes phase gate verdicts, cross-system holistic review",
      "",
      "Skills with `model: haiku`: `/help`, `/sprint-status`, `/story-readiness`, `/scope-check`,",
      "`/project-stage-detect`, `/changelog`, `/patch-notes`, `/onboard`",
      "",
      "Skills with `model: opus`: `/review-all-gdds`, `/architecture-review`, `/gate-check`",
      "",
      "All other skills default to Sonnet. When creating new skills, suggest Haiku if the",
      "skill only reads and formats; suggest Opus if it must synthesize 5+ documents with",
      "high-stakes output; otherwise leave unset (Sonnet).",
      "",
      "## Subagents",
      "",
      "Spawned via this harness's subagent tool, within a single Claude Code session. Used by all `team-*` skills",
      "and orchestration skills. Subagents share the session's permission context, run",
      "sequentially or in parallel within the session, and return results to the parent.",
      "",
      "**When to spawn in parallel**: If two subagents' inputs are independent (neither",
      "needs the other's output to begin), spawn both Task calls simultaneously rather",
      "than waiting. Example: `/review-all-gdds` Phase 1 (consistency) and Phase 2",
      "(design theory) are independent — spawn both at the same time.",
      "",
      "## Parallel Subagent Protocol",
    ].join("\n"));
  }
  if (outName === "context-management.md") {
    // "Recovery After Session Crash" step 1 describes a session-start hook
    // detecting and previewing the state file automatically — this harness
    // has no such hook (see NOTICE); step 2 already says to read the state
    // file, so step 1 becomes "go find it yourself" rather than "it finds
    // itself for you".
    let out = text.split(
      "1. The `session-start.sh` hook will detect and preview `active.md` automatically",
    ).join(
      "1. There is no session-start hook here to do this automatically (see `NOTICE`) — check `production/session-state/active.md` yourself",
    );
    // Review-round finding (Important 5): `/clear` names a Claude Code
    // builtin this installed harness does not register (inventory.mjs
    // already classifies it as one, correctly excluded from the R4
    // whitelist) — only `/compact` exists here. Same defect class as the
    // 86 leftover `Task` instructions R2's delegation idioms fix: the
    // rewrite whitelist correctly refuses to touch a non-command mention,
    // but nothing then went back to fix the PROSE that names it. Two
    // sites, both real content this harness has no equivalent for:
    // "disruption (compaction, crash, /clear)" becomes "a new session"
    // (the closest real action to a full context wipe here); "Use /clear
    // between tasks" becomes "start a new session", since this harness has
    // no in-session context-clear distinct from compaction.
    out = out.split(
      "After any disruption (compaction, crash, `/clear`), read the state file first.",
    ).join(
      "After any disruption (compaction, crash, or starting a new session), read the state file first.",
    );
    out = out.split(
      "- **Use `/clear`** between unrelated tasks, or after 2+ failed correction attempts",
    ).join(
      "- **Start a new session** between unrelated tasks, or after 2+ failed correction attempts — this harness has no in-session equivalent to `/clear`; `/compact` reduces context but does not reset it",
    );
    return out;
  }
  if (outName === "skills-reference.md") {
    // "Type `/` in Claude Code" — the one Claude-Code-specific clause in an
    // otherwise harness-neutral sentence; the instruction itself ("type /
    // to see the menu") holds on this harness too.
    return text.split(
      "73 slash commands organized by phase. Type `/` in Claude Code to access any of them.",
    ).join(
      "73 slash commands organized by phase. Type `/` to access any of them.",
    );
  }
  if (outName === "gs-start") {
    // The onboarding skill's very first user-facing line names the
    // upstream project by its Claude-Code-era brand.
    return text.split(
      "Welcome to Claude Code Game Studios! Before I suggest anything, I'd like to",
    ).join(
      "Welcome to the Game Studio! Before I suggest anything, I'd like to",
    );
  }
  // Task 15 manual review, R3 sites: these five name the bare `Bash` tool
  // in a generic "run the test suite" instruction. Per rules.mjs' R3 doc
  // comment, `Bash` itself is deliberately never auto-rewritten (the
  // `standard` agent preset ships `tool-bash` on POSIX and `tool-pwsh` on
  // win32, so a blind `Bash` -> `bash` rewrite would point Windows at a
  // tool that does not exist there); each site gets its own literal fix
  // naming both real tools instead. The other four R3-listed sites
  // (gs-hotfix:74, gs-retrospective:61+64, pipeline/workflow-guide.md:39)
  // name "Git Bash" the actual Windows shell program a human installs
  // alongside Git, not this harness's tool, and are deliberately left
  // untouched — see review-log.md.
  if (outName === "gs-design-review") {
    // Review-round finding (Important 5): same `/clear` defect as
    // context-management.md/workflow-guide.md's identical-in-kind
    // sentences — see the context-management.md fixup block's comment.
    // Matched pre-R4 (bare `/design-review`, not yet `/gs-design-review`),
    // same as every other fixupClaudeDocResidue block that names a command.
    let out = text.split(
      "- Note current context usage: if context is above ~50%, add: \"(Recommended: /clear before re-review — this session has used X% context. A full re-review runs 5 agents and needs clean context.)\"",
    ).join(
      "- Note current context usage: if context is above ~50%, add: \"(Recommended: start a new session before re-review — this session has used X% context. A full re-review runs 5 agents and needs clean context.)\"",
    );
    out = out.split(
      "  - `[A] Re-review in a new session — run /design-review [doc-path] after /clear`",
    ).join(
      // "in a new session" already says what "after /clear" was trying to
      // add — this harness has no /clear to add it with, and the phrase
      // was redundant even upstream, so dropped rather than reworded.
      "  - `[A] Re-review in a new session — run /design-review [doc-path]`",
    );
    return out;
  }
  if (outName === "gs-bug-report") {
    return text.split(
      "if the bug's system has a test file in `tests/`, run it via Bash and report pass/fail.",
    ).join(
      "if the bug's system has a test file in `tests/`, run it via the shell tool (`bash` on POSIX, `pwsh` on Windows) and report pass/fail.",
    );
  }
  if (outName === "gs-gate-check") {
    let out = text.split(
      "- [ ] Tests are passing (run test suite via Bash)",
    ).join(
      "- [ ] Tests are passing (run test suite via the shell tool — `bash` on POSIX, `pwsh` on Windows)",
    );
    out = out.split(
      "- For test checks: Run the test suite via `Bash` if a test runner is configured",
    ).join(
      "- For test checks: Run the test suite via the shell tool (`bash` on POSIX, `pwsh` on Windows) if a test runner is configured",
    );
    // Delegation-idiom nit (charter item 2): the generic "via Task" -> "via
    // a subagent" rewrite (TASK_DELEGATION_PHRASES in rules.mjs) turns this
    // sentence into "...as **parallel subagents** via a subagent using...",
    // a plural noun bumping into the singular article the rule inserts.
    // Fixed here by dropping "via Task" outright — "as **parallel
    // subagents**" already names the mechanism, and the very next sentence
    // ("Issue all four Task calls simultaneously") still carries the
    // generic rewrite to "subagent calls" untouched, so this does not
    // duplicate or alter TASK_DELEGATION_PHRASES' own wording anywhere
    // else in the corpus.
    out = out.split(
      "spawn all four directors as **parallel subagents** via Task using the parallel gate protocol from",
    ).join(
      "spawn all four directors as **parallel subagents** using the parallel gate protocol from",
    );
    return out;
  }
  if (outName === "gs-smoke-check") {
    return text.split(
      "Attempt to run the test suite via Bash. Select the command based on the engine",
    ).join(
      "Attempt to run the test suite via the shell tool (`bash` on POSIX, `pwsh` on Windows). Select the command based on the engine",
    );
  }
  if (outName === "gs-story-done") {
    let out = text.split(
      "- **Test pass check**: if a test file path is mentioned, run it via `Bash`.",
    ).join(
      "- **Test pass check**: if a test file path is mentioned, run it via the shell tool (`bash` on POSIX, `pwsh` on Windows).",
    );
    // Review-round finding (Important 1): an AFFIRMATIVE claim that a
    // hook actively runs today, the same defect class already fixed
    // throughout workflow-guide.md. `validate-commit.sh` is one of the
    // 12 upstream PreToolUse hooks (its own reference doc is in
    // EXCLUDED_DOCS); NOTICE says none of the 12 execute here. Redirect
    // to NOTICE and turn the promised automatic check into a manual one,
    // matching the phrasing already used for context-management.md and
    // workflow-guide.md's hook-residue fixes.
    out = out.split(
      "The `validate-commit.sh` hook will verify design doc references and check for hardcoded values automatically.",
    ).join(
      "There is no commit-validation hook on this harness to do this automatically (see `NOTICE`) — verify design doc references and check for hardcoded values yourself before running this commit.",
    );
    return out;
  }
  if (outName === "gs-brainstorm") {
    // Delegation-idiom nit (charter item 2), same shape as gs-gate-check
    // above: "spawn BOTH X AND Y via Task in parallel" would generically
    // become "...via a subagent in parallel", a plural pairing meeting a
    // singular article. Dropping "via Task" and folding its meaning into
    // "as parallel subagents" reads correctly and leaves the following
    // "Issue both Task calls simultaneously" sentence for the generic rule
    // to rewrite as usual.
    return text.split(
      "spawn BOTH `creative-director` AND `art-director` via Task in parallel before moving to Phase 5.",
    ).join(
      "spawn BOTH `creative-director` AND `art-director` as parallel subagents before moving to Phase 5.",
    );
  }
  if (outName === "director-gates.md") {
    // Delegation-idiom nit (charter item 2): "Spawn all [N] agents
    // simultaneously via Task" generically becomes "...via a subagent", a
    // placeholder plural meeting a singular article. Dropping "via Task"
    // here leaves "issue all Task calls before waiting..." to carry the
    // mechanism name via the generic rewrite, unchanged elsewhere.
    return text.split(
      "Spawn all [N] agents simultaneously via Task — issue all Task calls before",
    ).join(
      "Spawn all [N] agents simultaneously — issue all Task calls before",
    );
  }
  // Task 15 manual review, two MORE delegation-idiom nits of the same shape
  // as charter item 2, found while reading the five large skills and the
  // ten random skills (gs-design-system and gs-code-review are both in that
  // reviewed set). Same fix, same reasoning: drop "via Task" so the generic
  // "via a subagent" rewrite never fires on a plural subject.
  if (outName === "gs-design-system") {
    // Two identical occurrences (Sections C and D agent-delegation
    // callouts) share the same trailing phrase, so one split/join fixes
    // both — verified as exactly 2 hits in the upstream file.
    return text.split(
      "spawn specialist agents via Task in parallel:",
    ).join(
      "spawn specialist agents in parallel:",
    );
  }
  if (outName === "gs-code-review") {
    return text.split(
      "Spawn all applicable specialists simultaneously via Task — do not wait for one before starting the next.",
    ).join(
      "Spawn all applicable specialists simultaneously — do not wait for one before starting the next.",
    );
  }
  // Task 15 manual review: gs-skill-test's own structural linter (Check 1
  // and Check 4) requires an `allowed-tools:` frontmatter field. This
  // harness drops that field outright during porting (SKILL_DROP in
  // rules.mjs — a per-skill tool allowlist has no meaning here), so every
  // one of the 73 ported skills is now GUARANTEED to fail Check 1 and can
  // never trigger Check 4's FAIL branch correctly. Verified against
  // gs-ping's own hand-authored frontmatter too: it already carries
  // `name:`/`description:`/`disable-model-invocation:`/`user-invocable:`
  // at top level, so the rewritten Check 1 field list holds for it as well
  // — this fix does not need a second gs-ping-specific carve-out.
  if (outName === "gs-skill-test") {
    // Important 2 (review round): this skill's own opening description
    // names "hook" as part of its architecture — the same residual-machinery
    // problem the rest of this block's Check 1/6/7 fixes address, just in
    // prose rather than a checklist item.
    let out = text.split(
      "existing skill/hook/template architecture.",
    ).join(
      "existing skill/template architecture.",
    );
    out = out.split([
      "The file must contain all of these in the YAML frontmatter block:",
      "- `name:`",
      "- `description:`",
      "- `argument-hint:`",
      "- `user-invocable:`",
      "- `allowed-tools:`",
      "",
      "**FAIL** if any are absent.",
    ].join("\n")).join([
      "The file must contain all of these top-level YAML frontmatter keys:",
      "- `name:`",
      "- `description:`",
      "- `disable-model-invocation:`",
      "- `user-invocable:`",
      "",
      "**FAIL** if any are absent. (This harness has no `allowed-tools:` field —",
      "upstream's per-skill tool allowlist is dropped during porting, not carried",
      "into metadata, so it never appears. `argument-hint:` and other upstream",
      "fields live inside a nested `metadata:` block instead of top-level — check",
      "for them there, not as a sibling of `name:`.)",
    ].join("\n"));
    // Follow-through: Check 6 and Check 7 have the identical root cause as
    // the allowed-tools defect above -- both validate frontmatter shaped
    // like upstream's, not what this port actually emits -- silent until
    // now only because both are WARN paths that simply never fire, rather
    // than an always-FAIL like Check 1/4. `context: fork` never occurs
    // anywhere in this corpus (upstream or ported), so Check 6 is dormant
    // either way; the fix is pointing it at the right nesting level for
    // the day a skill does carry it. `argument-hint` is real and present
    // on every ported skill, but under `metadata:`, not top-level.
    out = out.split(
      "If frontmatter contains `context: fork`, the skill should have ≥5 phase headings",
    ).join(
      "If the skill's `metadata:` block contains `context: fork` (no ported skill currently sets it), the skill should have ≥5 phase headings",
    );
    out = out.split(
      "`argument-hint` must be non-empty. If the skill body mentions multiple modes",
    ).join(
      "`argument-hint` (nested under `metadata:`, not top-level -- see Check 1) must be non-empty. If the skill body mentions multiple modes",
    );
    out = out.split(
      "**FAIL** if `allowed-tools` includes `Write` or `Edit` but no ask-before-write language is found.",
    ).join(
      "**FAIL** if the skill's body instructs writing or editing files but no ask-before-write language is found. (There is no `allowed-tools:` field on this harness to check instead — see Check 1.)",
    );
    return out;
  }
  if (outName === "gs-skill-improve") {
    let out = text.split(
      "- **Check 4 fail** → Write or Edit in allowed-tools but no ask-before-write language",
    ).join(
      "- **Check 4 fail** → the skill instructs writing or editing files but has no ask-before-write language",
    );
    // Follow-through: same root-cause fix as gs-skill-test's Check 6/7
    // above, mirrored here since this diagnosis table repeats both checks
    // verbatim.
    out = out.split(
      "- **Check 6 warn** → `context: fork` set but fewer than 5 phases found",
    ).join(
      "- **Check 6 warn** → `metadata.context: fork` set but fewer than 5 phases found",
    );
    out = out.split(
      "- **Check 7 warn** → argument-hint is empty or doesn't match documented modes",
    ).join(
      "- **Check 7 warn** → `metadata.argument-hint` is empty or doesn't match documented modes",
    );
    return out;
  }
  // Review-round reclassification: gs-retrospective:61/64 and
  // gs-hotfix:74 were originally left in the manual Bash-sites ledger as
  // "Git Bash the shell", but both name the AGENT'S TOOL, not a human's
  // shell -- the test is whether the sentence names the tool or the shell
  // a human is typing into, and both of these are instructions FROM the
  // skill TO the model, not a human-facing prerequisites list (that
  // distinction is what correctly keeps workflow-guide.md:39 classified
  // as the shell). Fixed the same way as the five originally-caught R3
  // sites, and the `2>/dev/null` POSIX-only redirection dropped outright
  // rather than given a pwsh equivalent -- neither command relies on
  // stderr being suppressed for its `||` fallback or its "fails or
  // returns empty" check to work, so removing it is the minimal fix that
  // does not need a second, platform-conditional command variant.
  if (outName === "gs-hotfix") {
    return text.split(
      "Check whether this is a git repository:\n\n`Bash: git rev-parse --is-inside-work-tree 2>/dev/null`",
    ).join(
      "Check whether this is a git repository, using the shell tool (`bash` on POSIX, `pwsh` on Windows):\n\n`git rev-parse --is-inside-work-tree`",
    );
  }
  if (outName === "gs-retrospective") {
    let out = text.split(
      "Use the Bash tool (which uses Git Bash on Windows — the `2>/dev/null` is bash syntax, not PowerShell):",
    ).join(
      "Use the shell tool (`bash` on POSIX, `pwsh` on Windows):",
    );
    out = out.split(
      'Bash: git log --oneline --since="4 weeks ago" 2>/dev/null || git log --oneline -20',
    ).join(
      'git log --oneline --since="4 weeks ago" || git log --oneline -20',
    );
    return out;
  }
  // Follow-through: the 7-site "sub-agents spawned via Task" pattern is
  // handled corpus-wide as a TASK_DELEGATION_PHRASES regex entry in
  // rules.mjs (verified unwrapped on all 7, same check as the 35-site
  // R14 fix). gs-dev-story additionally has ONE site of a different,
  // non-repeating shape -- "agent(s) via Task" -- not worth a second
  // corpus-wide regex for a single occurrence, so it is a literal here.
  if (outName === "gs-dev-story") {
    return text.split(
      "Spawn the chosen programmer agent(s) via Task with the full context package:",
    ).join(
      "Spawn the chosen programmer agent(s) with the full context package:",
    );
  }
  if (outName === "agent-coordination-map.md") {
    // Same defect class as gs-story-done's validate-commit.sh fix above:
    // "post-sprint hook" names upstream machinery this harness does not
    // execute. Unlike that site, this is a workflow-pattern diagram whose
    // five sibling steps all name a real `/command` instead of prose --
    // replacing the dead hook reference with `/retrospective` (a real,
    // whitelisted command R4 prefixes to `/gs-retrospective`) matches the
    // diagram's own established pattern rather than just deleting the
    // clause.
    return text.split(
      "6. producer           -- Sprint retrospective with post-sprint hook",
    ).join(
      "6. producer           -- Sprint retrospective with /retrospective",
    );
  }
  if (outName === "unity/PLUGINS.md") {
    // Review-round finding (Important 1, G3 clause 3): upstream typo, not a
    // rewrite artifact — the link TEXT (`modules/input.md`) already names
    // the correct same-directory target; only the destination carries a
    // spurious `../` that walks one level too far (to `content/engines/`,
    // where nothing lives). Two literal fixes, same file.
    let out = text.split("[modules/input.md](../modules/input.md)").join(
      "[modules/input.md](modules/input.md)",
    );
    out = out.split("[modules/ui.md](../modules/ui.md)").join(
      "[modules/ui.md](modules/ui.md)",
    );
    return out;
  }
  return text;
}

/**
 * Apply the body rules in a fixed order for one destination, counting hits.
 * @param text - the file body.
 * @param dest - one of {@link DEST}.
 * @param outPath - the content/-relative path this file is emitted to; passed
 *   through to rewritePaths/fixupPipelineRefs so the `../` depth is derived
 *   from where the file actually lives rather than a per-dest bucket
 *   constant (see resolveDepthPrefix's doc comment). Every call site below
 *   knows its own outPath before calling this, so there is no reason to
 *   fall back to the bucket here.
 */
function rewriteBody(text, dest, outPath) {
  let out = text;
  let r;
  r = rewriteUnconditionalToolsCounted(out); out = r.text; ruleHits.R1 += r.count;
  r = rewriteStructuredToolsCounted(out); out = r.text; ruleHits.R2 += r.count;
  // R4 (rewriteCommands) has no *Counted variant of its own — countCommandHits
  // already exists as its counting companion (see rules.mjs), measured
  // against the text BEFORE the rewrite the same way every other counter
  // here measures against its own step's input.
  ruleHits.R4 += countCommandHits(out);
  out = rewriteCommands(out);
  r = rewriteDelegationCounted(out); out = r.text; ruleHits.R5 += r.count;
  // fixupPipelineRefs' own PIPELINE_YAML_REF site (when present) is folded
  // into the same R6/R8 bucket conceptually but not counted below — a rare
  // (3-site) redirect handled before rewritePathsCounted runs, so it never
  // shows up in that count. Known, accepted gap.
  out = fixupPipelineRefs(out, dest, outPath);
  r = rewritePathsCounted(out, dest, outPath); out = r.text; ruleHits["R6/R8"] += r.count;
  r = rewriteClaudeMdCounted(out); out = r.text; ruleHits.R7 += r.count;
  r = rewriteClaudeCodeMentionsCounted(out); out = r.text; ruleHits.R14 += r.count;
  return out.replace(/\r\n/g, "\n");
}

/** Write one ported file, normalizing to LF (G2), and track it for the gates. */
function emit(rel, text) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  const lf = text.replace(/\r\n/g, "\n");
  writeFileSync(p, lf, "utf8");
  written.push({ path: rel, text: lf });
}

/**
 * Lines in a frontmatter fragment as returned by {@link splitFm} (the
 * content between the fences, WITHOUT them) or produced by
 * `yaml.stringify` — both end with a trailing "\n", so splitting on "\n"
 * always has one trailing empty string to discard.
 * @param fm - a frontmatter fragment, with a trailing newline.
 * @returns the number of real lines in `fm`.
 */
function fmLineCount(fm) {
  return fm.split("\n").length - 1;
}

/** Recursively list every `.md` file under `dir`, sorted, as `{ rel, full }`. */
function walkMd(dir, relPrefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkMd(full, rel));
    else if (entry.name.endsWith(".md")) out.push({ rel, full });
  }
  return out;
}

/** Recursively list every file (any extension) under `dir` — used only by G1. */
function walkAll(dir, relPrefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkAll(full, rel));
    else out.push({ rel, full });
  }
  return out;
}

/** The first sentence of a description, for the role index. */
function firstSentence(s) {
  const m = /^(.*?[.!?])(\s|$)/.exec(s);
  return m ? m[1] : s;
}

/**
 * Render `workflow-catalog.yaml`'s phase/step structure as Markdown. Field
 * selection is deliberately narrower than the upstream YAML: `artifact`
 * globs describe hook-driven auto-detection this harness does not have (see
 * NOTICE — hooks became checklists, not executable gates), so including them
 * would imply a capability that does not exist. Phase, step, command,
 * required/repeatable, and description are what a reader needs to know
 * where they are and what comes next.
 * @param yamlText - the raw upstream YAML text.
 * @returns a Markdown rendering, not yet run through the rewrite rules.
 */
function renderWorkflowCatalog(yamlText) {
  const data = parseYaml(yamlText) ?? {};
  const lines = [
    "# Workflow Catalog", "",
    "The authoritative 7-phase pipeline sequence. Read by `/gs-help` to work out where a project is and what comes next.",
    "",
    "Phase gate verdicts (`/gs-gate-check`) are ADVISORY — they guide the decision but never hard-block advancement. The user always decides whether to proceed.",
    "",
  ];
  for (const [key, phase] of Object.entries(data.phases ?? {})) {
    lines.push(`## ${phase.label ?? key} (\`${key}\`)`, "");
    if (phase.description) lines.push(phase.description, "");
    lines.push(`Next phase: ${phase.next_phase ? `\`${phase.next_phase}\`` : "none — this is the final phase"}`, "");
    lines.push("| Step | Command | Required | Description |", "|---|---|---|---|");
    for (const step of phase.steps ?? []) {
      const cmd = step.command ? `\`${step.command}\`` : "—";
      const required = step.required ? "Yes" : "No";
      const repeatable = step.repeatable ? " (repeatable)" : "";
      const desc = String(step.description ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
      lines.push(`| ${step.name}${repeatable} | ${cmd} | ${required} | ${desc} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// The port.
// ---------------------------------------------------------------------------

clearOwned();

// 1. Skills: .claude/skills/<name>/SKILL.md -> content/skills/gs-<name>/SKILL.md
const skillsSrcDir = join(snapshot, ".claude/skills");
const skillNames = readdirSync(skillsSrcDir, { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();

for (const name of skillNames) {
  const rawFile = readFileSync(join(skillsSrcDir, name, "SKILL.md"), "utf8");
  const outPath = `skills/gs-${name}/SKILL.md`;
  // fixupClaudeDocResidue runs before recordBashSites, same reasoning as
  // the handbook loop: for the one skill it touches (gs-start) it only
  // rewrites a single prose line, not a Bash-mentioning one, but the
  // ordering is kept consistent everywhere this function is called rather
  // than being case-by-case.
  const raw = fixupClaudeDocResidue(rawFile, `gs-${name}`);
  const [rawFm, rawBody] = splitFm(raw);
  // name ≡ dir (R12): the ported name feeds both the frontmatter and the
  // output path, so they can never drift apart.
  // R1 (Glob/Grep/WebSearch/WebFetch/TodoWrite/AskUserQuestion) and R7
  // (CLAUDE.md -> AGENTS.md) both run over the body via rewriteBody, but the
  // frontmatter is assembled separately by transformSkillFrontmatter and
  // never passes through either — two real corpus sites survive untouched
  // otherwise: gs-setup-engine's description mentions both "CLAUDE.md" and
  // "WebSearch"; gs-consistency-check's mentions "Grep". R1's names never
  // occur as English words, so applying it here is safe by that rule's own
  // definition — reuse the exported rules rather than hand-rolling a second
  // copy of either rewrite.
  const { frontmatter: skillFmRaw, routedRole } = transformSkillFrontmatter(rawFm, `gs-${name}`);
  const frontmatter = rewriteUnconditionalTools(rewriteClaudeMd(skillFmRaw));
  // Computed here, once both the upstream and regenerated frontmatter
  // exist, and passed through to correct the ledger's line numbers only —
  // see recordBashSites' doc comment for why the two rarely have the same
  // line count and what that does to a body-relative line number.
  recordBashSites(raw, outPath, fmLineCount(frontmatter) - fmLineCount(rawFm));
  let body = rewriteBody(rawBody, DEST.SKILL, outPath);
  if (routedRole) { body = appendRoutingLine(body, routedRole); ruleHits.R13++; } // R13: routing line, only where routedRole exists
  // No extra "\n" here: splitFm preserves the original blank line (if any)
  // as body's own leading newline, so inserting one more would double it.
  emit(outPath, `---\n${frontmatter}---\n${body}`);
}

// 2. Roles: .claude/agents/<name>.md -> content/roles/<name>.md, plus a
//    generated index.
const rolesSrcDir = join(snapshot, ".claude/agents");
const roleNames = readdirSync(rolesSrcDir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
const roleIndexEntries = [];

for (const name of roleNames) {
  const raw = readFileSync(join(rolesSrcDir, `${name}.md`), "utf8");
  const outPath = `roles/${name}.md`;
  const [rawFm, rawBody] = splitFm(raw);
  // CALLER CONTRACT (transformRoleFrontmatter): raw, pre-R1/R2 frontmatter in.
  const { frontmatter: roleFmRaw, advisory } = transformRoleFrontmatter(rawFm, name);
  // Same reasoning as the skill frontmatter above: R1 and R7 only run over
  // the body via rewriteBody, so apply both here too.
  const frontmatter = rewriteUnconditionalTools(rewriteClaudeMd(roleFmRaw));
  // Same reasoning as the skills loop above: transformRoleFrontmatter drops
  // tools/disallowedTools/maxTurns/memory/isolation/skills from the
  // frontmatter entirely (they become the advisory prose block in the body
  // instead), so the upstream and regenerated frontmatter blocks almost
  // never share a line count. No role currently has a Bash mention in its
  // body — the ledger has zero roles/ entries today — but the correction
  // costs nothing and keeps the ledger correct the day one does.
  recordBashSites(raw, outPath, fmLineCount(frontmatter) - fmLineCount(rawFm));
  // R1/R2 run over the body BEFORE the advisory is spliced in, so the
  // advisory's quoted upstream tool list (Read, Glob, Grep, ...) is never
  // itself rewritten — splicing it earlier would let rewriteUnconditionalTools'
  // bare \bGlob\b/\bGrep\b lowercase it into a half-migrated list.
  let body = rewriteBody(rawBody, DEST.DOC, outPath);
  if (!body.endsWith("\n")) body += "\n";
  body += advisory;
  // No extra "\n" here: splitFm preserves the original blank line (if any)
  // as body's own leading newline, so inserting one more would double it.
  emit(outPath, `---\n${frontmatter}---\n${body}`);

  const parsed = parseYaml(frontmatter);
  roleIndexEntries.push({ name, tier: parsed.tier, department: parsed.department, description: parsed.description });
}

const indexLines = [
  "# Role index", "",
  "Generated by the port from the 49 role briefs. Do not hand-edit — fix the",
  "upstream role brief or the port rules and re-run `port.mjs`.", "",
];
for (const r of roleIndexEntries) {
  indexLines.push(`- \`${r.name}\` (tier ${r.tier}, ${r.department}) — ${firstSentence(r.description ?? "")}`);
}
emit("roles/_index.md", indexLines.join("\n") + "\n");

// 3. Templates: .claude/docs/templates/**.md -> content/templates/**.md.
//    Top-level files are DEST.DOC (one level under content/); the nested
//    collaborative-protocols/ files are DEST.DOC_NESTED (two levels).
const templatesSrcDir = join(snapshot, ".claude/docs/templates");
let templatesCount = 0;
for (const { rel, full } of walkMd(templatesSrcDir)) {
  const raw = readFileSync(full, "utf8");
  const outPath = `templates/${rel}`;
  recordBashSites(raw, outPath);
  const dest = rel.includes("/") ? DEST.DOC_NESTED : DEST.DOC;
  emit(outPath, rewriteBody(raw, dest, outPath));
  templatesCount++;
}

// 4. Rules: .claude/rules/*.md -> content/rules/*.md.
const rulesSrcDir = join(snapshot, ".claude/rules");
let rulesCount = 0;
for (const f of readdirSync(rulesSrcDir).filter((f) => f.endsWith(".md")).sort()) {
  const raw = readFileSync(join(rulesSrcDir, f), "utf8");
  const outPath = `rules/${f}`;
  recordBashSites(raw, outPath);
  emit(outPath, rewriteBody(raw, DEST.DOC, outPath));
  rulesCount++;
}

// 5. Engine reference: docs/engine-reference/** -> content/engines/**.
const enginesSrcDir = join(snapshot, "docs/engine-reference");
let enginesCount = 0;
for (const { rel, full } of walkMd(enginesSrcDir)) {
  const raw = readFileSync(full, "utf8");
  const outPath = `engines/${rel}`;
  // fixupClaudeDocResidue runs BEFORE recordBashSites, same reasoning as
  // the handbook and skills loops: for the one engine doc it touches
  // (unity/PLUGINS.md) it only corrects two link targets, not a
  // Bash-mentioning line, but the ordering is kept consistent everywhere
  // this function is called rather than being case-by-case.
  const fixedRaw = fixupClaudeDocResidue(raw, rel);
  recordBashSites(fixedRaw, outPath);
  emit(outPath, rewriteBody(fixedRaw, DEST.DOC_NESTED, outPath));
  enginesCount++;
}

// 6. Handbook: .claude/docs/*.md (excluding templates/, and excluding the
//    10-document exclusion list) -> content/handbook/*.md.
const docsSrcDir = join(snapshot, ".claude/docs");
let handbookCount = 0;
let excludedCount = 0;
const excludedFound = [];
for (const { rel, full } of walkMd(docsSrcDir)) {
  if (rel === "templates" || rel.startsWith("templates/")) continue; // handled above
  if (EXCLUDED_DOCS.includes(rel)) {
    excludedCount++;
    excludedFound.push(rel);
    continue;
  }
  const raw = readFileSync(full, "utf8");
  const outPath = `handbook/${rel}`;
  // fixupClaudeDocResidue runs BEFORE recordBashSites (unlike every other
  // rewrite, which runs after): it deletes whole blocks rather than editing
  // a token in place, so for the two files it touches the ledger must see
  // the block already gone — otherwise it would report a Bash mention on a
  // line number, and inside text, that no longer exists in the shipped
  // file (quick-start.md's now-deleted "Git Bash, jq, Python" line, from
  // the setup-requirements.md entry the replaced tree no longer lists). Is
  // a no-op for every file but directory-structure.md and quick-start.md —
  // see its doc comment for why those two keep their content but need a
  // literal override PATH_MAP cannot express.
  const fixedRaw = fixupClaudeDocResidue(raw, rel);
  recordBashSites(fixedRaw, outPath);
  emit(outPath, rewriteBody(fixedRaw, DEST.DOC, outPath));
  handbookCount++;
}

// 7. Pipeline: workflow-catalog.yaml (converted) + WORKFLOW-GUIDE.md.
const catalogRaw = readFileSync(join(snapshot, ".claude/docs/workflow-catalog.yaml"), "utf8");
recordBashSites(catalogRaw, "pipeline/workflow-catalog.md");
emit("pipeline/workflow-catalog.md", rewriteBody(renderWorkflowCatalog(catalogRaw), DEST.DOC, "pipeline/workflow-catalog.md"));

const guideRaw = readFileSync(join(snapshot, "docs/WORKFLOW-GUIDE.md"), "utf8");
// Same ordering as the handbook loop above, and for the same reason: the
// ledger must see the hook sections already replaced, not the pre-fixup
// text naming them.
const fixedGuideRaw = fixupClaudeDocResidue(guideRaw, "workflow-guide.md");
recordBashSites(fixedGuideRaw, "pipeline/workflow-guide.md");
emit("pipeline/workflow-guide.md", rewriteBody(fixedGuideRaw, DEST.DOC, "pipeline/workflow-guide.md"));

// Derived from written, not hardcoded: the two emit() calls above are the
// only writers under pipeline/, so this is the one G4 slot that would
// actually catch a regression (a future third pipeline file, or one of the
// two calls above being removed) instead of trivially passing forever.
const pipelineCount = written.filter((f) => f.path.startsWith("pipeline/")).length;

// ---------------------------------------------------------------------------
// Gates. Every gate runs and every problem prints BEFORE any exit — a single
// process.exit(1) per gate would make every later gate unreachable dead code
// whenever an earlier one fails, and G3 has legitimately failed on the real
// corpus before (see the port report history) and may again as content
// grows, so G4 and G1 must not depend on G3 passing to even run. Collected
// into one exit at the end instead. The
// manifest write is still withheld on ANY failure — that is a separate,
// deliberate decision: a partial manifest describing a rejected port would
// itself be a stale artifact.
// ---------------------------------------------------------------------------

let anyGateFailed = false;

const g3problems = checkReferentialIntegrity(written);
if (g3problems.length > 0) {
  anyGateFailed = true;
  console.error(`G3 referential integrity: ${g3problems.length} problem(s)`);
  for (const p of g3problems) console.error(`  ${p}`);
}

const skillDirs = readdirSync(join(OUT, "skills"), { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name);
const skillsFirstParty = skillDirs.includes("gs-ping") ? 1 : 0;
const skillsPortedOnDisk = skillDirs.length - skillsFirstParty;

const counts = {
  skills: skillDirs.length,
  roles: roleNames.length,
  templates: templatesCount,
  rules: rulesCount,
  engines: enginesCount,
  handbook: handbookCount,
  pipeline: pipelineCount,
  excluded: excludedCount,
};

const g4problems = checkCounts(counts);
if (g4problems.length > 0) {
  anyGateFailed = true;
  console.error(`G4 counts: ${g4problems.length} problem(s)`);
  for (const p of g4problems) console.error(`  ${p}`);
}

// G1: re-read every file under content/skills/** from disk rather than
// trusting `written` — disk is ground truth (it also correctly covers
// gs-ping, which `written` never includes since the port never writes it).
const skillFiles = walkAll(join(OUT, "skills")).map(({ rel, full }) => ({
  path: `skills/${rel}`,
  text: readFileSync(full, "utf8"),
}));
const g1problems = checkMarkerLeaks(skillFiles);
if (g1problems.length > 0) {
  anyGateFailed = true;
  console.error(`G1 marker leak: ${g1problems.length} problem(s)`);
  for (const p of g1problems) console.error(`  ${p}`);
}

if (anyGateFailed) process.exit(1);

// R3: every Bash mention needing manual review — bashSites is already a
// flat one-entry-per-site ledger (not one-entry-per-file), so its length
// IS the site count with no further reduction needed.
ruleHits.R3 = bashSites.length;
// R10/R11: transformSkillFrontmatter/transformRoleFrontmatter run
// unconditionally over every skill/role file — every file IS a site, so
// the site count is just how many files went through each transform.
ruleHits.R10 = skillNames.length;
ruleHits.R11 = roleNames.length;

writeFileSync(MANIFEST_PATH, renderManifest({
  sha: UPSTREAM_SHA,
  counts,
  skillsPorted: skillsPortedOnDisk,
  skillsFirstParty,
  ruleHits,
  excluded: [...excludedFound].sort(),
  bashSites,
}).replace(/\r\n/g, "\n"), "utf8");

console.log(`port: wrote ${written.length} files to content/`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
console.log(`  skills breakdown: ${skillsPortedOnDisk} ported + ${skillsFirstParty} first-party`);
console.log(`manifest: ${MANIFEST_PATH}`);
process.exit(0);
