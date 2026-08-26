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
// claim, so the NEXT count change (Task 20/21 adding ten more
// orchestration skills) turns this test red instead of shipping a second,
// independently-stale copy of a number EXPECTED_COUNTS already centralizes.
//
// Deliberately NOT updated to claim 12 orchestration skills here: today
// there are genuinely 2 (gs-studio, gs-roster). This test must be true
// now — it is Task 21's job to make both the description and this test's
// expectation move together, not this task's.

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

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
