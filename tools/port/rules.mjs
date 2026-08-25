/**
 * The port's rewrite rules, as pure string functions.
 *
 * Nothing here touches the filesystem. That is deliberate: every rule is
 * fixture-tested in isolation, which is the only mechanism that catches a
 * rule quietly mangling prose somewhere inside 2.2 MB of ported text.
 *
 * The tool-name rules are split into three, and the split is empirical, not
 * stylistic. `Read` appears 247 times upstream: 3 backticked, 1 as "Read
 * tool", and 102 as a sentence-initial imperative. A blind word-boundary
 * replace would corrupt the 99% that is English.
 *
 * @module tools/port/rules
 */

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

/** R1: rewrite the names that cannot collide with prose. */
export function rewriteUnconditionalTools(text) {
  let out = text;
  for (const [from, to] of Object.entries(UNCONDITIONAL)) {
    out = out.replace(new RegExp(`\\b${from}\\b`, "g"), to);
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
      out = out.replace(new RegExp(`\\b${from} tool\\b`, "g"), `${to} tool`);
    }
  }
  return out;
}

/**
 * R3: report every `Bash` site for manual rewriting; never rewrite it.
 *
 * The `standard` agent preset disables `tool-bash` on win32 and ships only
 * `tool-pwsh`, so rewriting `Bash` to `bash` would point the model at a tool
 * that does not exist on Windows. Nine sites is few enough to handle by hand.
 * @param text - one file's full text.
 * @returns one entry per matching line, 1-indexed.
 */
export function findBashSites(text) {
  const sites = [];
  text.split("\n").forEach((line, i) => {
    if (/\bBash\b/.test(line)) sites.push({ line: i + 1, text: line });
  });
  return sites;
}
