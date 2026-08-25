/**
 * Publish gates and the port manifest.
 *
 * These exist because a broken reference in ported content fails silently:
 * the model follows a path that does not resolve, or types a command the
 * menu does not carry, and nothing errors. The final review of Phase 1
 * caught that failure class at N=6; this phase takes N into the thousands.
 *
 * @module tools/port/manifest
 */
import { isCommand, isRole } from "./inventory.mjs";

/**
 * The exact inventory a complete port produces, measured against the pinned
 * upstream snapshot rather than estimated.
 *
 * `skills` is the AGGREGATE of the 73 skills the port writes and the 1
 * first-party `gs-ping` install probe Phase 1 already ships under
 * `content/skills/` (never touched by the port). Checking only the
 * aggregate here is deliberate — the split that keeps a short port visible
 * behind it (rather than masked by an unrelated extra summing back to 74)
 * lives in the rendered manifest, not in this gate; see {@link renderManifest}.
 */
export const EXPECTED_COUNTS = Object.freeze({
  skills: 74, roles: 49, templates: 40, rules: 11,
  engines: 46, handbook: 13, pipeline: 2, excluded: 9,
});

/**
 * G3: every reference in the ported corpus must resolve.
 * @param files - the ported files, each with its content-relative path.
 * @returns one human-readable problem per broken reference.
 */
export function checkReferentialIntegrity(files) {
  const problems = [];
  for (const { path, text } of files) {
    for (const m of text.matchAll(/(?<![\w/-])\/(gs-[a-z0-9-]+)/g)) {
      // isCommand() on the un-prefixed name, not a separately maintained
      // "known ported commands" set — one source of truth, same as the
      // rewrite rule itself, so this check can't quietly desync from it.
      if (!isCommand(m[1].slice(3))) problems.push(`${path}: unknown command /${m[1]}`);
    }
    for (const m of text.matchAll(/roles\/([a-z0-9-]+)\.md/g)) {
      // isRole(), not a bare `ROLES[name] === void 0` lookup: ROLES is a
      // plain object, so `ROLES["constructor"]` is truthy via the prototype
      // chain even though "constructor" is never a real role — the same
      // pitfall rules.mjs documents for transformSkillFrontmatter.
      if (m[1] !== "_index" && !isRole(m[1])) {
        problems.push(`${path}: role brief does not exist: ${m[1]}`);
      }
    }
    if (text.includes(".claude/")) problems.push(`${path}: leftover upstream path .claude/`);
    if (text.includes("CLAUDE.md")) problems.push(`${path}: leftover CLAUDE.md reference`);
  }
  return problems;
}

/**
 * G4: the port is complete only at the exact expected counts.
 * @param counts - actual counts by group.
 * @returns one problem per mismatch.
 */
export function checkCounts(counts) {
  const problems = [];
  for (const [group, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = counts[group];
    if (actual !== expected) problems.push(`${group}: expected ${expected}, got ${actual}`);
  }
  return problems;
}

/**
 * Render the manifest a human reads to spot a rule that changed too much.
 * @param data - `{ sha, counts, skillsPorted, skillsFirstParty, ruleHits, excluded, bashSites }`.
 *   `skillsPorted`/`skillsFirstParty` are reported alongside the `counts.skills`
 *   aggregate so a short port stays visible even when the aggregate alone
 *   would not show it (see {@link EXPECTED_COUNTS}).
 * @returns markdown.
 */
export function renderManifest(data) {
  const rows = Object.entries(data.ruleHits).map(([r, n]) => `| ${r} | ${n} |`);
  return [
    `# Port manifest`, ``,
    `Upstream: \`${data.sha}\``, ``,
    `## Counts`, ``,
    ...Object.entries(data.counts).map(([k, v]) => `- ${k}: ${v}`),
    `- skills breakdown: ${data.skillsPorted} ported + ${data.skillsFirstParty} first-party`, ``,
    `## Rule hits`, ``, `| rule | hits |`, `|---|---|`, ...rows, ``,
    `## Excluded (${data.excluded.length})`, ``,
    ...data.excluded.map((e) => `- ${e}`), ``,
    `## Bash sites needing manual rewrite (${data.bashSites.length})`, ``,
    ...data.bashSites.map((s) => `- ${s.file}:${s.line} — ${s.text}`), ``,
  ].join("\n");
}
