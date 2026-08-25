// Fail the build when any shipped skill would be silently dropped by the
// filesystem provider, or when a shipped command skill or role brief would
// leak a raw %%GS_ marker or a \r byte straight into a model's context.
// Run from the package root: node scripts/lint-content.mjs
import { checkNoMarkers, checkNoMarkersFlat, checkSkillRoot } from "../lib/content.js";
import { fileURLToPath } from "node:url";

const skillsRoot = fileURLToPath(new URL("../content/skills/", import.meta.url));
const rolesRoot = fileURLToPath(new URL("../content/roles/", import.meta.url));
const problems = [
  ...checkSkillRoot(skillsRoot),
  ...checkNoMarkers(skillsRoot),
  ...checkNoMarkersFlat(rolesRoot),
];
for (const problem of problems) {
  process.stderr.write(`${problem.dir}: [${problem.kind}] ${problem.detail}\n`);
}
if (problems.length > 0) {
  process.stderr.write(`\n${problems.length} problem(s) in the shipped content tree.\n`);
  process.exit(1);
}
process.stdout.write("content lint: all shipped skills and role briefs satisfy the provider's invariants\n");
