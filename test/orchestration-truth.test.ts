import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentDir } from "../src/content.js";
import { EXPECTED_COUNTS } from "../tools/port/manifest.mjs";

// Why EXPECTED_COUNTS and not a fresh readdir: each directory counts
// differently (roles/ and templates/ exclude their generated _index.md,
// engines/ counts recursively, skills/ counts directories). Those
// conventions are already encoded in EXPECTED_COUNTS, and G4 pins
// EXPECTED_COUNTS to disk on every port run. Asserting prose against
// EXPECTED_COUNTS therefore chains prose -> EXPECTED_COUNTS -> disk,
// rather than re-deriving three special cases here and getting them wrong.

describe("orchestration skills tell the truth about what ships", () => {
  const orchDir = `${contentDir()}orchestration/`;
  const files = readdirSync(orchDir).filter((f) => f.endsWith(".md"));

  it("has orchestration files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every 'N of N installed' claim matches the pinned count", () => {
    const problems: string[] = [];
    for (const file of files) {
      const text = readFileSync(`${orchDir}${file}`, "utf8");
      for (const m of text.matchAll(
        /%%GS_CONTENT_DIR%%([a-z]+)[^\n]*?(\d+) of (\d+) installed/g,
      )) {
        const [, dir, have, total] = m;
        const expected = EXPECTED_COUNTS[dir as keyof typeof EXPECTED_COUNTS];
        if (expected === undefined) {
          problems.push(`${file}: claims a count for ${dir}/, which EXPECTED_COUNTS does not pin`);
        } else if (Number(have) !== expected || Number(total) !== expected) {
          problems.push(`${file}: claims ${have} of ${total} for ${dir}/, pinned count is ${expected}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("never claims a directory is not shipped when it is", () => {
    const problems: string[] = [];
    for (const file of files) {
      const text = readFileSync(`${orchDir}${file}`, "utf8");
      for (const m of text.matchAll(/%%GS_CONTENT_DIR%%([a-z]+)[^\n]*?not shipped yet/g)) {
        const dir = m[1]!;
        if (readdirSync(`${contentDir()}${dir}/`).length > 0) {
          problems.push(`${file}: says ${dir}/ is not shipped, but it has files`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
