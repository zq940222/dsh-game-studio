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
 * R6/R8: rewrite an upstream path to its content/ location, expressed the way
 * the destination file can actually resolve it.
 *
 * Orchestration files are loaded as runtime skills with markers substituted at
 * apply time, so they use `%%GS_CONTENT_DIR%%`. Everything else is shipped
 * VERBATIM by the filesystem provider — a marker in one of them would reach
 * the model unsubstituted with no error at all — so they use a path relative
 * to their own location, at the depth {@link DEST} declares for that
 * destination. Anything that is not exactly `DEST.ORCHESTRATION` falls
 * through to a relative form rather than the marker; that fallback is what
 * guarantees a marker can never reach a command skill, so it must not be
 * narrowed to an exact match on every known destination.
 * @param text - one file's full text.
 * @param dest - one of {@link DEST}.
 * @returns the text with upstream paths redirected.
 */
const DEPTH_PREFIX = Object.freeze({
  [DEST.ORCHESTRATION]: "%%GS_CONTENT_DIR%%",
  [DEST.DOC]: "../",
  [DEST.SKILL]: "../../",
  [DEST.DOC_NESTED]: "../../",
});

export function rewritePaths(text, dest) {
  const prefix = DEPTH_PREFIX[dest];
  // Fail loud on an unrecognized dest instead of silently falling through to
  // "../../" — that fallback used to produce the wrong depth for a DOC-class
  // file with nothing to catch it, the exact defect Task 10 fixed once
  // already. A future caller passing a typo'd or new dest gets an error
  // here instead of a link that resolves nowhere.
  if (prefix === void 0) throw new Error(`rewritePaths: unrecognized dest "${dest}"`);
  let out = text;
  for (const [from, to] of PATH_MAP) {
    out = out.split(from).join(prefix + to);
  }
  return out;
}

/** R7: the workspace instruction file is `AGENTS.md` on this harness. */
export function rewriteClaudeMd(text) {
  return text.split("CLAUDE.md").join("AGENTS.md");
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
