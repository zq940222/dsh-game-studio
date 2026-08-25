// One-off: run R2 over the upstream snapshot and report how much it changed.
//
// This number is a "something unexpected happened" signal, not an
// authorization. It has never once been the thing that catches a real
// defect — both times a false positive slipped in (the C# `Task` async
// type), it was the changed-*line* audit that caught it, not this count.
// What the count is good for is telling you when to go do that audit.
//
// Expected baseline: files=196 changed=70 changedLines=94, measured against
// the upstream snapshot at commit 984023d, audited line-by-line and found
// entirely genuine (Read/Write/Edit's backtick+phrase positions, Task's
// phrase-only position, and the three COMPOUND_PHRASES entries in
// rules.mjs). Threshold: 80, for slack above that baseline.
//
// If a rule change moves this number, the correct response is to audit the
// *delta* (the newly changed files/lines) by hand, confirm each site is a
// genuine tool reference, and update the baseline above to match — not to
// raise the threshold to whatever the new number happens to be. Only stop
// and ask before committing if `changed` exceeds the threshold, since that
// is specifically the case an unaudited eyeball check hasn't covered yet.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { rewriteStructuredTools } from "./rules.mjs";

const root = process.argv[2];
let files = 0, changed = 0, diffs = 0;
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith(".md")) {
      files++;
      const before = readFileSync(p, "utf8");
      const after = rewriteStructuredTools(before);
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
console.log(`files=${files} changed=${changed} changedLines=${diffs}`);
