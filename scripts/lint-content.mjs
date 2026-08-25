// Fail the build when any shipped skill would be silently dropped by the
// filesystem provider. Run from the package root: node scripts/lint-content.mjs
import { checkNoMarkers, checkSkillRoot } from "../lib/content.js";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../content/skills/", import.meta.url));
const problems = [...checkSkillRoot(root), ...checkNoMarkers(root)];
for (const problem of problems) {
  process.stderr.write(`${problem.dir}: [${problem.kind}] ${problem.detail}\n`);
}
if (problems.length > 0) {
  process.stderr.write(`\n${problems.length} problem(s) — these skills would vanish silently.\n`);
  process.exit(1);
}
process.stdout.write("content lint: all shipped skills satisfy the provider's invariants\n");
