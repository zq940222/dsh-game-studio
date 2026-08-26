// Fail the build when any shipped skill would be silently dropped by the
// filesystem provider, or when any shipped content would leak a raw
// %%GS_ marker or a \r byte straight into a model's context.
// Run from the package root: node scripts/lint-content.mjs
import { readdirSync, statSync } from "node:fs";
import { checkNoMarkers, checkNoMarkersTree, checkSkillRoot } from "../lib/content.js";
import { fileURLToPath } from "node:url";

const contentRoot = fileURLToPath(new URL("../content/", import.meta.url));
const skillsRoot = `${contentRoot}skills/`;

// skills/ gets its own more specific coverage: checkSkillRoot's structural
// invariants (the provider's name/kebab/boolean rules) plus checkNoMarkers
// for G1/G2.
//
// Every OTHER directory under content/ gets G1/G2 via the generic
// recursive checkNoMarkersTree — EXCEPT orchestration/, which loads
// through orchestration.ts and therefore (a) already gets its own
// CRLF-normalize + fail-loud %%GS_ scan, and (b) legitimately CONTAINS
// %%GS_ markers by design, before substitution; linting it here would
// flag correct content.
//
// The rule is expressed as an exception ("every directory except
// orchestration/"), not as an enumerated allowlist of directories to
// check: an allowlist goes stale the moment a new directory lands under
// content/ — as Task 14 did three times over (handbook/, templates/,
// engines/, pipeline/) and Task 22 did again for project/. project/ is
// NOT part of the port (global-constraints.md) and uses `{{...}}`
// placeholders rather than `%%GS_`, but that needed no special case
// here: checkNoMarkersTree only ever flags `%%GS_` and `\r`, so it
// already accepts `{{...}}` and already rejects a stray `%%GS_` (which
// nothing would ever substitute inside project/) exactly like every
// other swept-in directory. "skills" is excluded from THIS loop only to
// avoid double-reporting what the dedicated call above already covers —
// it is not exempt from G1/G2 itself.
const problems = [...checkSkillRoot(skillsRoot), ...checkNoMarkers(skillsRoot)];
for (const entry of readdirSync(contentRoot)) {
  if (entry === "skills" || entry === "orchestration") continue;
  const path = `${contentRoot}${entry}`;
  if (!statSync(path).isDirectory()) continue;
  problems.push(...checkNoMarkersTree(`${path}/`));
}

for (const problem of problems) {
  process.stderr.write(`${problem.dir}: [${problem.kind}] ${problem.detail}\n`);
}
if (problems.length > 0) {
  process.stderr.write(`\n${problems.length} problem(s) in the shipped content tree.\n`);
  process.exit(1);
}
process.stdout.write("content lint: shipped content passes the filesystem provider's own invariants and this package's publish gates\n");
