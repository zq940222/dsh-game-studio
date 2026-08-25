// One-off: run R2 and R4 over the upstream snapshot and report how much
// each changed.
//
// This number is a "something unexpected happened" signal, not an
// authorization. It has never once been the thing that catches a real
// defect — both times a false positive slipped in (the C# `Task` async
// type), it was the changed-*line* audit that caught it, not this count.
// What the count is good for is telling you when to go do that audit.
//
// Expected baseline: files=196 changed=151 changedLines=1270 r4Hits=1268,
// measured against the upstream snapshot at commit 984023d. R2's slice
// (Read/Write/Edit's backtick+phrase positions, Task's phrase-only
// position, and the three COMPOUND_PHRASES entries in rules.mjs) was
// audited earlier at changed=70 changedLines=94.
//
// R4's slice (1268 command hits against the whitelist in inventory.mjs) was
// added by this task. Its hit count is *larger* than the 997 raw
// slash-shaped strings named in the task brief as a calibration ceiling.
// That 997 figure's provenance (what pattern, what scope) is not stated in
// the brief and could not be reproduced by any measurement taken while
// building this rule, at any regex or directory scope tried (see
// task-9-report.md) — so it is not used here as ground truth.
//
// What actually proves the whitelist IS being consulted, measured in this
// exact `.claude`/*.md scope with this rule's own regex: raw slash-shaped
// candidates = 1350, of which only 1268 pass isCommand() — the other 82
// were audited individually and are all real filesystem paths (`/root`,
// `/dev`, `/bin`, `/src`), glob fragments (`/enemies`, `/characters` inside
// `**/enemies/**`), and Claude Code's own `/clear` and `/compact`, none of
// which are in the 73-name whitelist and none of which got rewritten. The
// 1268 accepted hits were themselves sampled (60 lines) and are all
// genuine `/command-name` references — this subtree is the corpus *about*
// the command system, so a high density of real hits is expected. Full
// sampling and the 82-exclusion list are in task-9-report.md. Threshold:
// 170, for slack above this combined baseline.
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
import { isCommand } from "./inventory.mjs";
import { rewriteCommands, rewriteStructuredTools } from "./rules.mjs";

// Mirrors rewriteCommands' own regex so the hit count reflects exactly what
// the rule matched and accepted against the whitelist, not a re-derived
// approximation of it.
function countCommandHits(text) {
  let hits = 0;
  text.replace(/(?<![\w/-])\/([a-z][a-z0-9-]*)/g, (match, name) => {
    if (isCommand(name)) hits++;
    return match;
  });
  return hits;
}

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
