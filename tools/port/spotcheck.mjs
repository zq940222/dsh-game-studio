// One-off: run R2 and R4 over the upstream snapshot and report how much
// each changed.
//
// This number is a "something unexpected happened" signal, not an
// authorization. It has never once been the thing that catches a real
// defect — both times a false positive slipped in (the C# `Task` async
// type), it was the changed-*line* audit that caught it, not this count.
// A third false positive (below) was caught the same way: not by this
// count, but by a reviewer categorizing every accepted hit by the
// character preceding the slash. What the count is good for is telling
// you when to go do that audit.
//
// Expected baseline: files=196 changed=151 changedLines=1881 r4Hits=1263,
// measured against the upstream snapshot at commit 984023d. `files`,
// `changed`, and `r4Hits` are stable since the number below this one was
// written; only `changedLines` moved, 1265 -> 1881, when Task 15 added
// TASK_DELEGATION_PHRASES' `sub-agents spawned via Task` entry and
// rewriteClaudeCodeMentions' new entries (the latter is not even in this
// script's R2/R4-only scope — the `changed` file set didn't move, so the
// growth is entirely inside files this script already counted).
//
// R2's slice (rewriteStructuredTools run alone, no rewriteCommands — i.e.
// Read/Write/Edit's backtick+phrase positions, Task's phrase-only position,
// the three COMPOUND_PHRASES entries, AND (since Task 15) the six
// TASK_DELEGATION_PHRASES entries, all in rules.mjs) was audited earlier at
// changed=70 changedLines=94; today it measures changed=95 changedLines=718.
// 537 of those 718 lines are ONE file, skills/review-all-gdds/SKILL.md
// (640 lines before, 639 after): `Task\s+agents` -> `subagents` collapses
// its one wrapped `Task\nagents` site into a single line, and this script's
// diff counter is a naive POSITIONAL line comparison — every line after the
// shift point spuriously reads as "changed" until the file ends, not
// because the content differs but because line N's content no longer sits
// at row N. This is exactly the artifact TASK_DELEGATION_PHRASES' own doc
// comment already predicts (`Task\s+agents` -> `subagents` "removes a
// line"), audited here and confirmed harmless: a real per-line diff (not
// this script's positional one) on that file shows exactly the one
// intended edit. The remaining 718 - 537 = 181-line delta across the other
// 94 changed files is the six TASK_DELEGATION_PHRASES entries' genuine new
// hit population, not further audited line-by-line here since none of it
// is a line-count-changing rewrite the way the one collapsed phrase is.
//
// R4's slice (1263 command hits against the whitelist in inventory.mjs)
// was added by this task and initially measured at 1268 — 5 higher than
// the number now here. Those 5 were a real defect: R4's original pattern
// excluded a preceding word character, `/`, or `-`, but not `]`, so
// `production/releases/[version]/patch-notes.md` had its final path
// segment misread as a command start (the `]` in `[version]` isn't a word
// character) and got corrupted to `.../gs-patch-notes.md` — a filename
// that would not exist. A reviewer caught this by categorizing all 1268
// accepted hits by the character preceding the slash: six categories were
// 0% false positive, the `]`-preceded category was 5/5. Fixed by adding
// `]` to COMMAND_SLASH_RE's lookbehind, plus an orthogonal file-extension
// lookahead for the same defect *class* (a path basename colliding with a
// command name need not always be `]`-preceded) — verified against this
// corpus to remove exactly the same 5 sites and no others; see
// COMMAND_SLASH_RE's doc comment in rules.mjs and task-9-report.md for the
// isolation measurement.
//
// A calibration figure of 997 was floated earlier as an upper bound this
// count should stay far below. It turned out to be a measurement error on
// the coordinator's side, not a defect in this rule — re-confirmed against
// this same corpus. What actually demonstrates the whitelist is being
// consulted, independent of that figure: measured in this exact
// `.claude`/*.md scope with COMMAND_SLASH_RE, raw candidates = 1323, of
// which 1263 pass isCommand() — the other 60 were audited individually
// and are all real filesystem paths (`/root`, `/dev`, `/bin`, `/src`),
// glob fragments from content-audit's recursive directory globs, and
// Claude Code's own `/clear` and `/compact`, none of which are in the
// 73-name whitelist and none of which got rewritten. The 1263 accepted
// hits were themselves sampled and are all genuine `/command-name`
// references — this subtree is the corpus *about* the command system, so
// a high density of real hits is expected. Full sampling and the
// 60-exclusion list are in task-9-report.md. Threshold: 170, for slack
// above this combined baseline.
//
// If a rule change moves this number, the correct response is to audit the
// *delta* (the newly changed files/lines) by hand, confirm each site is a
// genuine tool or command reference, and update the baseline above to
// match — not to raise the threshold to whatever the new number happens to
// be. Only stop and ask before committing if `changed` exceeds the
// threshold, since that is specifically the case an unaudited eyeball check
// hasn't covered yet.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { countCommandHits, rewriteCommands, rewriteStructuredTools } from "./rules.mjs";

const root = process.argv[2];
let files = 0, changed = 0, diffs = 0, r4Hits = 0;
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith(".md")) {
      files++;
      const before = readFileSync(p, "utf8");
      const after = rewriteCommands(rewriteStructuredTools(before));
      r4Hits += countCommandHits(before);
      if (before !== after) {
        changed++;
        const beforeLines = before.split("\n");
        const afterLines = after.split("\n");
        diffs += beforeLines.filter((l, i) => l !== afterLines[i]).length;
        console.log(`  ${p}`);
      }
    }
  }
}
walk(root);
console.log(`files=${files} changed=${changed} changedLines=${diffs} r4Hits=${r4Hits}`);
