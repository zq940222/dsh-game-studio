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

import { isCommand, isRole } from "./inventory.mjs";

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

/** R1: rewrite the names that cannot collide with prose. */
export function rewriteUnconditionalTools(text) {
  let out = text;
  for (const [from, to] of Object.entries(UNCONDITIONAL)) {
    out = out.replace(new RegExp("\\b" + from + "\\b", "g"), to);
  }
  return out;
}

/** R2: rewrite English-word tool names ONLY where the position marks them as tools. */
export function rewriteStructuredTools(text) {
  let out = text;
  for (const [from, { to, positions }] of Object.entries(STRUCTURED)) {
    if (positions.includes("backtick")) {
      // A backtick span containing exactly the tool name and nothing else.
      out = out.replace(new RegExp("`" + from + "`", "g"), "`" + to + "`");
    }
    if (positions.includes("phrase")) {
      // The explicit "<Name> tool" phrase.
      out = out.replace(new RegExp("\\b" + from + " tool" + "\\b", "g"), `${to} tool`);
    }
  }
  // Compound phrases: exact literal substitution, no regex needed — see
  // COMPOUND_PHRASES for why these three have no over-match surface.
  for (const [from, to] of COMPOUND_PHRASES) {
    out = out.split(from).join(to);
  }
  return out;
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
 * those are "Git Bash" the shell, not the tool, and stay in the manual
 * ledger anyway rather than adding a third guess-prone skip condition.
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
  return text.replace(/`subagent_type:\s*([^`]+)`/g, (match, raw) => {
    const value = raw.trim();
    if (value.startsWith("[")) {
      return `a subagent for \`${value}\` (the child reads its own brief under \`roles/\`)`;
    }
    if (!isRole(value)) return match;
    return `delegate to \`${value}\` (the child reads \`roles/${value}.md\` itself)`;
  });
}
