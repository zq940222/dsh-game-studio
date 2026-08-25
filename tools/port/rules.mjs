/**
 * The port's rewrite rules, as pure string functions.
 *
 * Nothing here touches the filesystem. That is deliberate: every rule is
 * fixture-tested in isolation, which is the only mechanism that catches a
 * rule quietly mangling prose somewhere inside 2.2 MB of ported text.
 *
 * The tool-name rules are split into three, and the split is empirical, not
 * stylistic. `Read` appears 437 times in the upstream `.claude` tree: only 3
 * backticked and 1 as an explicit "Read tool" phrase; the rest is ordinary
 * prose, 232 of it sentence-initial imperatives ("Read the existing ADR file
 * completely."). A blind word-boundary replace would corrupt the vast
 * majority that is English.
 *
 * @module tools/port/rules
 */

import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { ROLES, isCommand, isRole } from "./inventory.mjs";

/** Tool names that never occur as English words in the upstream corpus. */
const UNCONDITIONAL = Object.freeze({
  Glob: "glob",
  Grep: "grep",
  WebSearch: "web_search",
  WebFetch: "web_fetch",
  TodoWrite: "todo_write",
  AskUserQuestion: "ask_user_question",
});

/**
 * Tool names that ARE English words; rewritten only in structured positions.
 *
 * Each entry declares which of R2's two structured positions apply to that
 * name — not every name is safe in every position. `Read`, `Write`, and
 * `Edit` are safe in both: their combined 9 bare-backtick sites in the
 * upstream corpus are all genuine tool references. `Task` is the exception:
 * this corpus is about game engines, and `Task` is also C#/C++/.NET's async
 * return type. Audited across the whole corpus there are exactly 2
 * bare-backticked `` `Task` `` sites — one genuine ("Spawned via `Task`
 * within a single Claude Code session"), one a C# `Task.Delay()`/`await`
 * discussion that a rewrite would turn to nonsense. A 50% error rate over a
 * position's entire population means the position isn't worth having, so
 * `Task` keeps only the "Task tool" phrase (audited at 16 sites, all
 * genuine) and drops the bare-backtick position. This is a removal of an
 * unsafe position for one name, not a third position added to the rule.
 */
const STRUCTURED = Object.freeze({
  Read: { to: "read", positions: ["backtick", "phrase"] },
  Write: { to: "write", positions: ["backtick", "phrase"] },
  Edit: { to: "edit", positions: ["backtick", "phrase"] },
  Task: { to: "subagent", positions: ["phrase"] },
});

/**
 * Compound phrases R2's per-name positions structurally cannot reach: the
 * phrase position requires "<Name> tool" with nothing between or after, so
 * it fails on a "/" separator and on the plural "s". These three strings are
 * the entire measured population in the upstream corpus — there is no
 * fourth variant, and the lowercase forms ("edit tools", "write tools")
 * occur zero times. Enumerated exact literals, not a generalized "tools?"
 * pattern, so there is no over-match surface beyond these three lines.
 */
const COMPOUND_PHRASES = Object.freeze([
  ["Write/Edit tools", "write/edit tools"],
  ["Write or Edit tools", "write or edit tools"],
  ["Task subagent", "subagent"],
]);

/**
 * Delegation idioms that pair "Task" with a following word — the corpus's
 * DOMINANT way of naming the delegation mechanism, measured after a Task 14
 * review caught that the initial COMPOUND_PHRASES pass covered "Task tool"
 * (15 sites) and "Task subagent" (16) but missed the rest: 38 ported files
 * carrying ~86 imperative "spawn via Task" / "issue N Task calls" commands
 * to call a tool this harness does not have. Measured population, each
 * reviewed for false positives (none found — no C# `Task`, no task-tracking
 * prose):
 *   - "via Task" (78) — "spawn `art-director` via Task", "(via Task)
 *     returns BLOCKED". By far the dominant idiom.
 *   - "Task calls" (11) — "issue all four Task calls simultaneously".
 *   - "Task agents" (2) — one of the two wrapped across a line break in the
 *     source (`Task\nagents`), which is exactly why this list uses regexes
 *     with `\s+` rather than a literal split/join: a fixed-string match
 *     would silently miss that one.
 *   - "Task prompt" (1) — "do not serialize document content into the Task
 *     prompt".
 *   - "Task in this skill" (1) — design-review.md's CRITICAL callout.
 * Deliberately NOT a blanket `\bTask\b` -> `subagent`: that would also
 * rewrite 57 frontmatter tool-allowlist lines (moot in practice — those are
 * dropped by transformSkillFrontmatter/kept verbatim as advisory prose by
 * transformRoleFrontmatter, so rewriteStructuredTools never actually sees
 * them — but the corpus still contains them as raw text this rule must not
 * assume), the C# `Task.Delay()`/`async Task<T>` samples in
 * godot-csharp-specialist.md and the engine-reference Addressables docs,
 * the `| ID | Task | Owner | ... |` table header in producer.md, and the
 * work-item field labels (`Task: Implement hitbox detection`,
 * `(Epic, Feature, Task)`, bracketed `[Task 1]` placeholders in templates)
 * that name a project-management "task", not the delegation tool. Every one
 * of those keeps bare `Task` deliberately — verified by re-scanning the
 * ported output for every remaining bare `Task` after this list runs (see
 * the port report's residual list).
 */
// `Task\s+agents` -> `subagents` collapses two words into one, so on the
// one corpus site where the source wraps across the join point
// (review-all-gdds/SKILL.md's `Task\nagents`) this rule removes a line —
// unlike rewriteClaudeCodeMentions' `a\s+Claude-evaluated` entry, there is
// no whitespace left in the two-word-to-one-word output to replay the
// original newline into. Confirmed harmless for the current corpus: that
// file carries no Bash site after the join point (recordBashSites' line
// numbers are otherwise all computed from PRE-rewriteBody text, so a rule
// that changes a file's line count without report.mjs feeding the delta
// back in — the way the frontmatter-regeneration delta is — could, if that
// changed, misreport a later Bash site's line by one).
// `sub-agents\s+spawned\s+via\s+Task` MUST run before the generic
// `via\s+Task` entry below (array order == application order in the
// for-loop in rewriteStructuredTools), or the generic entry fires first and
// leaves "sub-agents spawned via a subagent" — a plural noun echoing right
// back into the singular article the generic rule inserts, the exact
// "review round" defect class as gs-gate-check/gs-brainstorm/director-
// gates.md (fixed as one-off fixupClaudeDocResidue overrides, since those
// three each needed a different surrounding rewrite) and gs-design-system/
// gs-code-review (found the same way, fixed the same way — see port.mjs).
// This one is corpus-wide instead: the EXACT phrase "sub-agents spawned via
// Task" recurs identically in 7 files (gs-dev-story, gs-team-audio,
// gs-team-combat, gs-team-level, gs-team-live-ops, gs-team-narrative,
// gs-team-polish), always immediately followed by ". Each sub-agent
// enforces..." — verified unwrapped in all 7 (grep across the raw upstream
// tree), so a literal-shaped regex has no mid-phrase-wrap gap to worry
// about, the same check the 35-site R14 "rules/hooks" fix and this array's
// own `Task\s+agents` entry both document. Dropping "spawned via Task"
// entirely (not rewording to "via a subagent") reads cleanly in all 7,
// since "sub-agents" alone already names the mechanism and the very next
// sentence ("Each sub-agent enforces...") still carries it.
const TASK_DELEGATION_PHRASES = Object.freeze([
  [/\bsub-agents\s+spawned\s+via\s+Task\b/g, "sub-agents"],
  [/\bvia\s+Task\b/g, "via a subagent"],
  [/\bTask\s+calls\b/g, "subagent calls"],
  [/\bTask\s+agents\b/g, "subagents"],
  [/\bTask\s+prompt\b/g, "subagent prompt"],
  [/\bTask\s+in\s+this\s+skill\b/g, "The subagent tool in this skill"],
]);

/**
 * Apply a sequence of `[pattern, replacement]` pairs IN ORDER, tracking how
 * many individual sites were replaced — not how many files/calls changed.
 *
 * Order-sensitive by design, the same way the rule sequences it drives are:
 * each pattern is counted and applied against the OUTPUT of the previous
 * step, not independently against the original text. That matters whenever
 * one entry's match text is a substring of a later entry's pattern (e.g.
 * TASK_DELEGATION_PHRASES' `sub-agents spawned via Task` containing the
 * later, more generic `via Task` — counting both independently against the
 * original text would double-count that one site). `pattern` is a global
 * RegExp or a literal string (counted via `split().length - 1`, matching
 * how the rule itself applies a literal via `split().join()`).
 * @param text - the input text.
 * @param pairs - `[pattern, replacement]` entries, same shape the rule
 *   tables in this module already use.
 * @returns `{ text, count }` — the rewritten text and total site count.
 */
function applyCounted(text, pairs) {
  let out = text;
  let count = 0;
  for (const [from, to] of pairs) {
    if (from instanceof RegExp) {
      const matches = out.match(from);
      if (matches) count += matches.length;
      out = out.replace(from, to);
    } else {
      count += out.split(from).length - 1;
      out = out.split(from).join(to);
    }
  }
  return { text: out, count };
}

const UNCONDITIONAL_PAIRS = Object.entries(UNCONDITIONAL).map(
  ([from, to]) => [new RegExp("\\b" + from + "\\b", "g"), to],
);

/**
 * R1: rewrite the names that cannot collide with prose.
 * @returns `{ text, count }` — count is the number of individual sites
 *   rewritten (spec §5's unit), not the number of files touched.
 */
export function rewriteUnconditionalToolsCounted(text) {
  return applyCounted(text, UNCONDITIONAL_PAIRS);
}

/** R1: rewrite the names that cannot collide with prose. */
export function rewriteUnconditionalTools(text) {
  return rewriteUnconditionalToolsCounted(text).text;
}

/** R2: rewrite English-word tool names ONLY where the position marks them as tools. */
const STRUCTURED_PAIRS = Object.entries(STRUCTURED).flatMap(([from, { to, positions }]) => {
  const pairs = [];
  if (positions.includes("backtick")) {
    // A backtick span containing exactly the tool name and nothing else.
    pairs.push([new RegExp("`" + from + "`", "g"), "`" + to + "`"]);
  }
  if (positions.includes("phrase")) {
    // The explicit "<Name> tool" phrase.
    pairs.push([new RegExp("\\b" + from + " tool" + "\\b", "g"), `${to} tool`]);
  }
  return pairs;
});

/**
 * R2: rewrite English-word tool names ONLY where the position marks them as
 * tools, plus the compound phrases and Task delegation idioms folded into
 * the same rule.
 * @returns `{ text, count }` — see {@link applyCounted}; the three
 *   sub-tables (STRUCTURED positions, COMPOUND_PHRASES,
 *   TASK_DELEGATION_PHRASES) are applied in the SAME order the plain
 *   `rewriteStructuredTools` uses, via one `applyCounted` call, so a site
 *   double-counted or missed here is a site double-applied or missed there
 *   too — the two can't quietly desync.
 */
export function rewriteStructuredToolsCounted(text) {
  return applyCounted(text, [...STRUCTURED_PAIRS, ...COMPOUND_PHRASES, ...TASK_DELEGATION_PHRASES]);
}

/** R2: rewrite English-word tool names ONLY where the position marks them as tools. */
export function rewriteStructuredTools(text) {
  return rewriteStructuredToolsCounted(text).text;
}

/**
 * R3: report every `Bash` site for manual rewriting; never rewrite it.
 *
 * The `standard` agent preset disables `tool-bash` on win32 and ships only
 * `tool-pwsh`, so rewriting `Bash` to `bash` would point the model at a tool
 * that does not exist on Windows.
 *
 * Frontmatter tool lists (`tools:`, `allowed-tools:`, `disallowedTools:`)
 * and `Bash(...)` permission specs are skipped: unfiltered, they made up
 * roughly 91% of the raw matches (103 lines across 88 files) and drowned
 * the handful of genuine prose sites a human actually needs to review.
 * Filtered, the upstream corpus leaves 18 sites across 11 files — 4 of
 * those are "Git Bash" the shell, not the tool. This rule deliberately does
 * not add a third guess-prone skip condition to filter them out on sight;
 * whether one survives into the port's own final manual-rewrite ledger
 * instead depends on whether a later, file-specific fixupClaudeDocResidue
 * override happens to touch that line for an unrelated reason. As of Task
 * 15's manual pass only 1 of the 4 remains in the shipped ledger
 * (`tools/port/manifest.md`, regenerated by every port run) — the other 3
 * were incidentally resolved by unrelated literal overrides. Re-run the
 * port and read the manifest rather than trusting this count to stay
 * current.
 * @param text - one file's full text.
 * @returns one entry per matching prose line, 1-indexed.
 */
const FRONTMATTER_TOOL_KEY = /^\s*(tools|allowed-tools|disallowedTools)\s*:/i;

export function findBashSites(text) {
  const sites = [];
  text.split("\n").forEach((line, i) => {
    if (!/\bBash\b/.test(line)) return;
    if (FRONTMATTER_TOOL_KEY.test(line)) return;
    if (line.includes("Bash(")) return;
    sites.push({ line: i + 1, text: line });
  });
  return sites;
}

/**
 * R4/R12's slash-shaped-candidate pattern, shared by the rewrite and its
 * counter so the two can never silently desync.
 *
 * Measured against the real upstream `.claude` corpus (196 files): 1323 raw
 * candidates, of which 1263 are genuine commands and 60 are genuine
 * non-commands — real filesystem paths (`/root`, `/dev`, `/bin`, `/src`),
 * glob fragments (`/enemies` inside content-audit's recursive directory
 * glob), and Claude Code's own
 * `/clear` and `/compact`, none of which are in this project's 73-name
 * whitelist. The whitelist earns its place by excluding that real 60, not
 * because commands are rare — within this corpus most slash-shaped strings
 * genuinely are commands, since the corpus is the command system's own
 * documentation.
 *
 * Two exclusions beyond the whitelist check itself, both earned by a real
 * corpus site, not written defensively:
 * - A preceding `]` is excluded in addition to word/`/`/`-` characters.
 *   Without it, a bracketed path segment like
 *   `production/releases/[version]/patch-notes.md` has its final path
 *   segment misread as a command start, because `]` is not a word
 *   character. A preceding `[` is NOT excluded — `[/story-done runs after
 *   QA signs off]` is a genuine command mention and must still rewrite.
 * - A following `.` + alphanumeric (a file extension) is excluded via
 *   trailing lookaheads. A command reference is never immediately followed
 *   by a file extension; a path's basename can coincidentally match a
 *   command name and be followed by one (`.../changelog.md`,
 *   `.../patch-notes.md`). The `(?![a-z0-9-])` lookahead directly after the
 *   captured name forces the engine to fail the whole match — rather than
 *   quietly backtracking to a shorter, wrong capture — whenever the
 *   trailing-extension check rejects the maximal name. A bare command with
 *   trailing punctuation and no extension (`Run /changelog.`) still
 *   rewrites: nothing alphanumeric immediately follows that period.
 */
const COMMAND_SLASH_RE = /(?<![\w/\]-])\/([a-z][a-z0-9-]*)(?![a-z0-9-])(?!\.[a-z0-9]+)/g;

/**
 * R4/R12: prefix slash commands, whitelist-driven.
 *
 * Consulting the whitelist is what makes filesystem paths, glob fragments,
 * and Claude Code's own builtins immune instead of collateral damage. See
 * COMMAND_SLASH_RE's doc comment for the measured corpus breakdown and the
 * two non-whitelist exclusions. Applies to frontmatter values too, since
 * `description:` also names commands.
 * @param text - one file's full text.
 * @returns the text with every known command prefixed exactly once.
 */
export function rewriteCommands(text) {
  return text.replace(COMMAND_SLASH_RE, (match, name) =>
    isCommand(name) ? `/gs-${name}` : match,
  );
}

/**
 * Counts how many slash-shaped candidates in `text` are genuine commands,
 * using rewriteCommands' own pattern and whitelist check rather than a
 * re-derived approximation — so a future edit to the rule can't silently
 * desync the reported metric from what the rule actually matched.
 * @param text - one file's full text.
 * @returns the number of candidates that pass isCommand().
 */
export function countCommandHits(text) {
  let hits = 0;
  text.replace(COMMAND_SLASH_RE, (match, name) => {
    if (isCommand(name)) hits++;
    return match;
  });
  return hits;
}

/**
 * R5: rewrite Claude Code's `subagent_type:` into the harness's delegation
 * shape, where the child reads its own role brief rather than having it
 * pasted into the prompt.
 *
 * A bracketed placeholder keeps its placeholder meaning — it names a class of
 * specialist, not a role file. An unrecognized role is left verbatim so the
 * manifest's referential-integrity gate reports it instead of the rule
 * silently inventing a path.
 * @param text - one file's full text.
 * @returns the rewritten text.
 */
export function rewriteDelegation(text) {
  return rewriteDelegationCounted(text).text;
}

/**
 * R5, counted. A "site" is a `subagent_type:` occurrence that ACTUALLY
 * changes (the placeholder form or a recognized role) — the "leaves an
 * unknown role untouched" branch returns the input verbatim and is
 * deliberately not counted, the same way an unmatched pattern anywhere
 * else in this file contributes zero to its rule's count.
 * @returns `{ text, count }`.
 */
export function rewriteDelegationCounted(text) {
  let count = 0;
  const out = text.replace(/`subagent_type:\s*([^`]+)`/g, (match, raw) => {
    const value = raw.trim();
    if (value.startsWith("[")) {
      count++;
      return `a subagent for \`${value}\` (the child reads its own brief under \`roles/\`)`;
    }
    if (!isRole(value)) return match;
    count++;
    return `delegate to \`${value}\` (the child reads \`roles/${value}.md\` itself)`;
  });
  return { text: out, count };
}

/**
 * Where a rewritten file will live, which decides both whether it gets the
 * substitution marker and, if not, how many `../` segments reach `content/`.
 *
 * The depth split exists because a relative path is resolved from the
 * REWRITTEN FILE'S OWN location, not from `content/`'s root, and that
 * location varies:
 *   - `content/skills/gs-<name>/SKILL.md` and `content/engines/<engine>/x.md`
 *     both sit two levels under `content/`, so `../../` reaches the root.
 *   - `content/handbook/x.md`, `content/templates/x.md`, `content/rules/x.md`,
 *     `content/roles/x.md`, and `content/pipeline/x.md` sit one level under
 *     `content/`, so `../../` overshoots by one — it resolves to the
 *     directory ABOVE `content/`, where nothing exists, and nothing catches
 *     the mistake: these files carry no resource base and no loader scans
 *     them for broken links, so a wrong depth is silent in exactly the way
 *     the marker rule exists to prevent, just running the other direction.
 */
export const DEST = Object.freeze({
  ORCHESTRATION: "orchestration",
  SKILL: "skill",
  DOC: "doc",
  DOC_NESTED: "doc-nested",
});

/** Upstream directory -> content/ subdirectory, longest prefix first. */
const PATH_MAP = Object.freeze([
  [".claude/docs/templates/", "templates/"],
  [".claude/docs/", "handbook/"],
  [".claude/agents/", "roles/"],
  [".claude/rules/", "rules/"],
  [".claude/skills/", "skills/gs-"],
  ["docs/engine-reference/", "engines/"],
]);

/**
 * The depth prefix each {@link DEST} resolves a path with. Exported so a
 * caller assembling its own path fragments for the same destination (e.g.
 * port.mjs's pipeline-relocation fixup, which rewrites a path PATH_MAP
 * cannot express) can reuse the single source of truth instead of
 * hand-rolling a second copy that can drift out of sync with this one.
 */
export const DEPTH_PREFIX = Object.freeze({
  [DEST.ORCHESTRATION]: "%%GS_CONTENT_DIR%%",
  [DEST.DOC]: "../",
  [DEST.SKILL]: "../../",
  [DEST.DOC_NESTED]: "../../",
});

/**
 * Resolve the `../` prefix a rewritten path should use.
 *
 * {@link DEPTH_PREFIX} is a per-DEST-bucket CONSTANT: it assumes every file
 * routed through a given `dest` sits at the same depth under `content/`.
 * That was wrong for `DEST.DOC_NESTED` the moment `engines/` started
 * emitting three different real depths under one bucket — `engines/README.md`
 * (1 level), `engines/<engine>/x.md` (2 levels, the case the bucket was
 * sized for), and `engines/<engine>/modules|plugins/x.md` (3 levels, 32 of
 * the 46 engine docs). `rewritePaths` only throws on an *unknown* dest,
 * never a wrong-but-known one, so a bucket sized for the wrong depth is
 * silent in exactly the way the DOC/DOC_NESTED split was created to kill —
 * just relocated one level deeper.
 *
 * When `outPath` is given (the normal case — every call site already knows
 * where its file is being emitted), the depth is derived from outPath's own
 * nesting under `content/` instead of trusted to the bucket, so a file's
 * prefix is always correct for where it actually lives. The bucket lookup
 * remains as a fallback for callers that only have a `dest` (e.g. tests
 * exercising the DEST-bucket behavior directly).
 * @param dest - one of {@link DEST}.
 * @param outPath - optional; the content/-relative path the file is
 *   actually emitted to (e.g. `"engines/unity/modules/input.md"`).
 * @returns the prefix, e.g. `"../../"` or `"%%GS_CONTENT_DIR%%"`.
 */
export function resolveDepthPrefix(dest, outPath) {
  if (dest === DEST.ORCHESTRATION) return DEPTH_PREFIX[DEST.ORCHESTRATION];
  if (outPath !== void 0) {
    const depth = (outPath.match(/\//g) ?? []).length;
    if (depth < 1) {
      throw new Error(`resolveDepthPrefix: outPath "${outPath}" has no directory depth under content/`);
    }
    return "../".repeat(depth);
  }
  const prefix = DEPTH_PREFIX[dest];
  if (prefix === void 0) throw new Error(`resolveDepthPrefix: unrecognized dest "${dest}"`);
  return prefix;
}

/**
 * R6/R8: rewrite an upstream path to its content/ location, expressed the way
 * the destination file can actually resolve it.
 *
 * Orchestration files are loaded as runtime skills with markers substituted at
 * apply time, so they use `%%GS_CONTENT_DIR%%`. Everything else is shipped
 * VERBATIM by the filesystem provider — a marker in one of them would reach
 * the model unsubstituted with no error at all — so they use a path relative
 * to their own location, at the depth {@link resolveDepthPrefix} resolves for
 * that file. An unrecognized `dest` with no `outPath` throws rather than
 * silently defaulting to any one depth: a silent default previously meant
 * "../../" for anything that wasn't exactly `DEST.ORCHESTRATION` or
 * `DEST.DOC`, which was the wrong depth for a DOC-class file with nothing to
 * catch it (the defect Task 10 fixed once already). Throwing means a typo'd
 * or future dest fails loudly here instead of producing a link that
 * resolves nowhere.
 * @param text - one file's full text.
 * @param dest - one of {@link DEST}.
 * @param outPath - optional; see {@link resolveDepthPrefix}. Every real port
 *   call site passes it; omitted only by callers testing the DEST-bucket
 *   fallback directly.
 * @returns the text with upstream paths redirected.
 */
export function rewritePaths(text, dest, outPath) {
  return rewritePathsCounted(text, dest, outPath).text;
}

/**
 * R6/R8, counted — the count is independent of `dest`/`outPath` (they only
 * pick the depth PREFIX substituted in, not which or how many PATH_MAP
 * sources match), so it is the same number regardless of destination.
 * @returns `{ text, count }`.
 */
export function rewritePathsCounted(text, dest, outPath) {
  const prefix = resolveDepthPrefix(dest, outPath);
  return applyCounted(text, PATH_MAP.map(([from, to]) => [from, prefix + to]));
}

/** R7: the workspace instruction file is `AGENTS.md` on this harness. */
export function rewriteClaudeMd(text) {
  return rewriteClaudeMdCounted(text).text;
}

/** R7, counted. @returns `{ text, count }`. */
export function rewriteClaudeMdCounted(text) {
  return applyCounted(text, [["CLAUDE.md", "AGENTS.md"]]);
}

/**
 * R14: literal, zero-false-positive rewrites of Claude Code's own branding,
 * model identity, and one piece of enforcement-machinery residue, wherever
 * they recur across the corpus rather than at one specific file. Each entry
 * was checked for a false-positive population before being added:
 *   - `Claude Code session` / `Claude session` (7 real sites, one file
 *     already excluded, one already replaced wholesale by a fixupClaudeDocResidue
 *     block) — the corpus's way of naming "a session of this assistant";
 *     regex so the optional `Code` and an optional plural both collapse to
 *     one line instead of four.
 *   - `Claude's training data` (1 site, engines/README.md) — the corpus
 *     elsewhere already says "the LLM's training data" for the identical
 *     fact (gs-setup-engine's description), so this reuses that vocabulary
 *     rather than inventing a second phrasing for the same idea.
 *   - `Ask Claude to` (1 site, workflow-guide.md) — an example prompt
 *     addressed to a specific model brand; this harness is model-agnostic.
 *   - `Claude-evaluated` (1 site, gs-skill-test) and `Claude (reverse-doc)`
 *     (3 sites, reverse-documentation templates) — both name the model
 *     performing the work, not Claude Code the harness, but are equally
 *     brand-specific on a model-agnostic harness.
 * Deliberately does NOT touch the "Upstream Claude Code granted this role
 * the configuration below" sentence transformRoleFrontmatter's advisory
 * block generates: that is a true, deliberate historical statement about
 * what upstream granted, not a residual leftover — see that function's own
 * doc comment.
 *   - `"If rules/hooks flag issues, fix them and explain what was wrong"`
 *     (35 sites — 34 role briefs sharing the "implementer" collaboration
 *     template, plus templates/collaborative-protocols/implementation-agent-
 *     protocol.md; Task 15 manual review, found while spot-checking 10
 *     random role briefs) — a conditional bullet in the "Implement with
 *     transparency" checklist. "Rules" (`content/rules/*.md`) are real on
 *     this harness; "hooks" are not (no pre-tool-use interception — see
 *     NOTICE), so a hook can never flag anything here. Every one of the 35
 *     sites is this exact full sentence, unwrapped (verified by grep across
 *     `content/`), so a whole-sentence literal has no false-positive
 *     surface and no mid-phrase-wrap gap to worry about, unlike
 *     TASK_DELEGATION_PHRASES' `Task\s+agents` entry.
 *   - `templates/skill-test-spec.md`'s Static Assertions checklist item (1
 *     site; Task 15 manual review, found via a residual grep after fixing
 *     the same `allowed-tools` defect in gs-skill-test/gs-skill-improve —
 *     see fixupClaudeDocResidue) names `allowed-tools` as a required
 *     frontmatter field a spec author checks for. Templates never pass
 *     through fixupClaudeDocResidue (see the templates loop in port.mjs),
 *     so a per-skill literal override cannot reach this file; R14 already
 *     runs over every destination via rewriteBody, so it is the correct
 *     mechanism for a template-only, single-site literal like this one.
 */
const CLAUDE_CODE_MENTIONS = Object.freeze([
  [/\bClaude(?:\s+Code)?\s+session(s?)\b/g, "session$1"],
  ["Claude's training data", "The LLM's training data"],
  ["Ask Claude to", "Ask the model to"],
  [
    "If rules/hooks flag issues, fix them and explain what was wrong",
    "If rules flag issues, fix them and explain what was wrong",
  ],
  [
    "- [ ] Has required frontmatter fields: `name`, `description`, `argument-hint`, `user-invocable`, `allowed-tools`",
    "- [ ] Has required top-level frontmatter fields: `name`, `description`, `disable-model-invocation`, `user-invocable` (this harness has no `allowed-tools` field — see Check 1 in `/gs-skill-test`)",
  ],
  // The leading article is part of the match (not just "Claude-evaluated"
  // -> "LLM-evaluated") because the one real site reads "This is a
  // Claude-evaluated reasoning check" — dropping in "LLM" alone would leave
  // the wrong article ("a LLM-evaluated"), since "LLM" takes "an". A regex
  // rather than a literal split/join because the source hard-wraps mid-
  // phrase here too ("This is a\nClaude-evaluated..."), the same shape of
  // gap TASK_DELEGATION_PHRASES' `Task\s+agents` entry exists for. The
  // whitespace itself is CAPTURED and replayed rather than collapsed to a
  // fixed space, so a wrapped source keeps its line count — unlike
  // `Task\s+agents` -> `subagents`, this replacement still has two words on
  // either side of a gap, so there is a place to put the original
  // whitespace back.
  [/\ba(\s+)Claude-evaluated\b/g, (_, ws) => `an${ws}LLM-evaluated`],
  ["Claude (reverse-doc)", "LLM (reverse-doc)"],
]);

export function rewriteClaudeCodeMentions(text) {
  return rewriteClaudeCodeMentionsCounted(text).text;
}

/** R14, counted. @returns `{ text, count }`. */
export function rewriteClaudeCodeMentionsCounted(text) {
  return applyCounted(text, CLAUDE_CODE_MENTIONS);
}

/** Keys that survive as top-level skill frontmatter; everything else folds into metadata. */
const SKILL_TOP_LEVEL = new Set(["name", "description", "user-invocable"]);
/** Keys with no harness meaning at all — dropped, not folded. */
const SKILL_DROP = new Set(["allowed-tools"]);

/**
 * R10/R12: reshape one upstream skill's frontmatter for the harness.
 *
 * `disable-model-invocation: true` is ADDED — upstream has no such key — and
 * upstream's `user-invocable` value is read and preserved (defaulting to
 * `true` only when upstream omits the key entirely, which never happens in
 * the current corpus — every one of the 73 skills sets it explicitly). It is
 * not hardcoded, because `user-invocable` is also excluded from the
 * `metadata` fold below: a hardcoded `true` would silently overwrite a
 * hypothetical upstream `false` with no trace of the original value
 * anywhere in the output. Everything else the harness has no field for
 * folds into the open `metadata` object rather than being discarded, since
 * the catalog carries only `name` and `description` and metadata
 * therefore costs nothing at model-facing prompt time.
 * `allowed-tools` is the one exception: it is dropped outright, not folded,
 * because it is a list of Claude Code tool names with no harness meaning at
 * all, folded or otherwise.
 *
 * The frontmatter is assembled as a plain object and rendered with
 * `yaml.stringify`, not hand-joined template strings. That is not a style
 * preference: measured against the real upstream corpus, 15 of 73 skill
 * descriptions (and 25 of 49 role descriptions, in the sibling transform)
 * contain a mid-string ": " — upstream double-quotes every description for
 * exactly this reason — and three skills (`changelog`, `help`, `sprint-plan`)
 * carry a `context: |` block-scalar of shell commands. A naive
 * `` `description: ${value}` `` line would silently misparse the first case
 * as an unintended nested mapping, and splice the second case's embedded
 * newline into the metadata block unindented, corrupting the YAML for every
 * key that followed it in the same file. `lineWidth: 0` additionally
 * disables yaml's default 80-column folding, which would otherwise wrap a
 * long plain-scalar description across lines unpredictably and break any
 * caller matching on its text.
 * @param raw - the upstream frontmatter block, without the `---` fences.
 * @param commandName - the ported name, e.g. `gs-dev-story`.
 * @returns the new frontmatter block and the routed role, if any.
 */
export function transformSkillFrontmatter(raw, commandName) {
  const data = parseYaml(raw) ?? {};
  const top = {
    name: commandName,
    description: rewriteCommands(String(data.description ?? "")).trim(),
    "disable-model-invocation": true,
    "user-invocable": data["user-invocable"] ?? true,
  };
  const metaEntries = Object.entries(data).filter(
    ([k]) => !SKILL_TOP_LEVEL.has(k) && !SKILL_DROP.has(k),
  );
  if (metaEntries.length > 0) {
    top.metadata = Object.fromEntries(metaEntries);
  }
  // isRole(), not a bare ROLES[...] truthiness check: ROLES is a plain
  // object, so `ROLES["constructor"]` is truthy via the prototype chain even
  // though "constructor" is never a real role.
  const routedRole = typeof data.agent === "string" && isRole(data.agent) ? data.agent : void 0;
  return { frontmatter: stringifyYaml(top, { lineWidth: 0 }), routedRole };
}

/** Keys that become an advisory prose block in the role brief's body. */
const ROLE_ADVISORY = ["tools", "disallowedTools", "maxTurns", "memory", "isolation", "skills"];

/**
 * R11: reshape one upstream agent definition into a role brief header.
 *
 * The harness has no per-agent tool allowlist, turn cap, or memory scope, so
 * those upstream fields would silently do nothing if kept as fields; instead
 * they become an advisory prose block the delegated child reads.
 *
 * The advisory quotes upstream's raw values as historical fact, not as an
 * instruction: `data[k]` here is read directly off the parsed upstream
 * frontmatter and is never passed through the R1/R2 body rewrite rules, and
 * the prose explicitly frames the list as what upstream Claude Code granted
 * this role, noting that this harness has no per-agent tool allowlist. A
 * half-migrated tool list (e.g. "Read, glob, grep, Write, Edit, Bash") would
 * be worse than either leaving it fully alone or dropping it, and `Bash`
 * specifically cannot be migrated at all — the `standard` agent preset
 * disables `tool-bash` on Windows.
 *
 * CALLER CONTRACT: `raw` must be the untouched upstream frontmatter — call
 * this before running the R1/R2 body rewrites on the rest of the file, and
 * splice the returned `advisory` into the body only after those rules have
 * already run over everything else, so the quoted list is never itself
 * rewritten.
 * @param raw - the upstream frontmatter block, without the `---` fences.
 * @param roleName - the role's file name without extension.
 * @returns the new frontmatter block and the advisory prose block.
 */
export function transformRoleFrontmatter(raw, roleName) {
  if (!isRole(roleName)) throw new Error(`port: unknown role "${roleName}"`);
  const data = parseYaml(raw) ?? {};
  const entry = ROLES[roleName];
  const top = {
    role: roleName,
    description: rewriteCommands(String(data.description ?? "")).trim(),
    tier: entry.tier,
    department: entry.department,
    "model-tier": data.model ?? "sonnet",
  };
  const frontmatter = stringifyYaml(top, { lineWidth: 0 });

  const present = ROLE_ADVISORY.filter((k) => data[k] !== void 0);
  const advisory = present.length === 0 ? "" : [
    "",
    "## Suggested tools and limits",
    "",
    "Upstream Claude Code granted this role the configuration below. This",
    "harness has no per-agent tool allowlist, turn cap, or memory scope, so",
    "none of it is enforced here — read it as a description of the role's",
    "intended scope, not as something this harness restricts or grants:",
    "",
    ...present.map((k) => `- \`${k}\`: ${Array.isArray(data[k]) ? data[k].join(", ") : data[k]}`),
    "",
  ].join("\n");

  return { frontmatter, advisory };
}

/**
 * R13: append the model-visible routing hint.
 *
 * The routed role also lives in the skill's `metadata` object (see
 * {@link transformSkillFrontmatter}), but metadata never reaches the model —
 * only the body does — so the same fact is repeated here where the model
 * will actually see it. Deliberate duplication, not redundancy.
 * @param body - the skill body.
 * @param role - the role that usually executes this command.
 * @returns the body with one appended line.
 */
export function appendRoutingLine(body, role) {
  const trimmed = body.endsWith("\n") ? body : body + "\n";
  return `${trimmed}\n---\n\nUsually executed by the \`${role}\` role. Load \`gs-roster\` for the delegation protocol.\n`;
}
