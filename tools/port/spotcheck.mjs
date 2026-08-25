// One-off: run R2 over the upstream snapshot and report how much it changed.
// Expected total: single digits. Anything larger means the rule is over-matching.
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
        diffs += before.split("\n").filter((l, i) => l !== after.split("\n")[i]).length;
        console.log(`  ${p}`);
      }
    }
  }
}
walk(root);
console.log(`files=${files} changed=${changed} changedLines=${diffs}`);
