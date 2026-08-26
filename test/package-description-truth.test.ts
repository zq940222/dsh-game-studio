import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contentDir } from "../src/content.js";
import { EXPECTED_COUNTS } from "../tools/port/manifest.mjs";

// package.json's `description` is prose a human reads in an npm-registry
// listing; nothing regenerates it from disk, so a stale number ships
// silently unless something reads it back and checks it against reality —
// exactly what happened here: Task 17 made handbook 13 (guards.md) and
// left this description saying 12. Same move as
// test/orchestration-truth.test.ts: convert a prose claim into a checked
// claim, so a count change (Task 21 adding seven `gs-phase-*` orchestration
// skills) turns this test red instead of shipping a second,
// independently-stale copy of a number EXPECTED_COUNTS already centralizes.
//
// README.md gets the same treatment below, in its own describe block: it
// is the third and last unchecked surface carrying these counts in prose
// (package.json's description and content/orchestration/*.md's own claims,
// covered by orchestration-truth.test.ts, were the first two) — see
// task-21-report.md.

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));

describe("package.json description tells the truth about what ships", () => {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { description: string };
  const { description } = pkg;

  it("has a description to check", () => {
    expect(typeof description).toBe("string");
    expect(description.length).toBeGreaterThan(0);
  });

  // Directory-backed counts: each noun phrase in the description maps to
  // an EXPECTED_COUNTS key — the same pinned-to-disk source G4 checks
  // every port run against, so this chains prose -> EXPECTED_COUNTS ->
  // disk rather than re-deriving the counts a second, independent way.
  const nounToKey: Record<string, keyof typeof EXPECTED_COUNTS> = {
    "command skills": "skills",
    "role briefs": "roles",
    "templates": "templates",
    "rules": "rules",
    "engine docs": "engines",
    "handbook docs": "handbook",
  };

  for (const [noun, key] of Object.entries(nounToKey)) {
    it(`claims the pinned ${key} count for "${noun}"`, () => {
      const m = new RegExp(`(\\d+)\\s+${noun}\\b`).exec(description);
      expect(m, `description does not mention "${noun}"`).not.toBeNull();
      expect(Number(m![1])).toBe(EXPECTED_COUNTS[key]);
    });
  }

  it('claims the live count of content/orchestration/*.md for "orchestration skills"', () => {
    // orchestration/ is Phase 1's, not the port's — EXPECTED_COUNTS does
    // not pin it (see global-constraints.md), so this counts disk directly
    // rather than through EXPECTED_COUNTS like the other clauses above.
    const orchCount = readdirSync(`${contentDir()}orchestration/`).filter((f) => f.endsWith(".md")).length;
    const m = /(\d+)\s+orchestration skills\b/.exec(description);
    expect(m, 'description does not mention "orchestration skills"').not.toBeNull();
    expect(Number(m![1])).toBe(orchCount);
  });
});

// README.md is a human-facing surface, not a generated one, but it makes
// the exact same kind of installed-count claims package.json's description
// does — including, per its own "cost of a shared profile" section, the
// central design claim this package makes (every orchestration skill's
// description sits in every session's model catalog permanently, whether
// the session needs game-dev content or not). A stale count there
// undermines that claim's credibility the same way a stale count in
// package.json undermines the npm listing. Same fix, same shape: read the
// file back and check every count claim against EXPECTED_COUNTS / the live
// orchestration directory count, rather than trusting the prose.
describe("README.md's count claims tell the truth about what ships", () => {
  const readme = readFileSync(readmePath, "utf8");

  it("has a README to check", () => {
    expect(readme.length).toBeGreaterThan(0);
  });

  // Noun phrases as README actually phrases them — deliberately NOT reused
  // verbatim from package.json's nounToKey above, because the two documents
  // phrase the same counts differently ("11 rules" in package.json's
  // description vs. "11 path-scoped coding-standard rule files" in
  // README's prose bullet list).
  const readmeNounToKey: Record<string, keyof typeof EXPECTED_COUNTS> = {
    "command skills": "skills",
    "role briefs": "roles",
    "document templates": "templates",
    "path-scoped coding-standard rule files": "rules",
    "per-engine reference docs": "engines",
    // \s+ between "handbook" and "documents" also matches the line break
    // README wraps this bullet across ("13 handbook\n  documents"), so this
    // one regex covers both the wrapped and unwrapped phrasing.
    "handbook\\s+documents": "handbook",
  };

  for (const [noun, key] of Object.entries(readmeNounToKey)) {
    it(`claims the pinned ${key} count for "${noun.replace(/\\s\+/, " ")}"`, () => {
      const m = new RegExp(`(\\d+)\\s+${noun}\\b`).exec(readme);
      expect(m, `README.md does not mention "${noun}"`).not.toBeNull();
      expect(Number(m![1])).toBe(EXPECTED_COUNTS[key]);
    });
  }

  it('claims the live count of content/orchestration/*.md for every "orchestration skills" mention', () => {
    // README makes this claim twice (the "Current state" bullet list and
    // "The cost of a shared profile" section) — checking only the first
    // match would leave the second free to drift independently, which is
    // exactly the failure mode this test exists to catch.
    const orchCount = readdirSync(`${contentDir()}orchestration/`).filter((f) => f.endsWith(".md")).length;
    const matches = [...readme.matchAll(/(\d+)\s+orchestration skills\b/g)];
    expect(matches.length, 'README.md does not mention "orchestration skills"').toBeGreaterThan(0);
    for (const m of matches) {
      expect(Number(m[1])).toBe(orchCount);
    }
  });
});
