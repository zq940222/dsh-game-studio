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

  it("every 'N of N installed' and prose count claim matches the pinned count", () => {
    const problems: string[] = [];

    // Map noun phrases to their corresponding directory
    const nounToDir: { [key: string]: string } = {
      "role brief": "roles",
      "role briefs": "roles",
      "document template": "templates",
      "document templates": "templates",
      "path-scoped coding standard": "rules",
      "path-scoped coding standards": "rules",
      "coding standard": "rules",
      "coding standards": "rules",
    };

    for (const file of files) {
      const text = readFileSync(`${orchDir}${file}`, "utf8");
      const matchedDirs = new Set<string>();

      // Match table format: %%GS_CONTENT_DIR%%<dir> ... N of N installed
      for (const m of text.matchAll(
        /%%GS_CONTENT_DIR%%([a-z]+)[^\n]*?(\d+) of (\d+) installed/g,
      )) {
        const [, dir, have, total] = m;
        matchedDirs.add(dir);
        const expected = EXPECTED_COUNTS[dir as keyof typeof EXPECTED_COUNTS];
        if (expected === undefined) {
          problems.push(`${file}: claims a count for ${dir}/, which EXPECTED_COUNTS does not pin`);
        } else if (Number(have) !== expected || Number(total) !== expected) {
          problems.push(`${file}: claims ${have} of ${total} for ${dir}/, pinned count is ${expected}`);
        }
      }

      // Match prose form: "All N role briefs are installed" etc
      // Build regex with known noun patterns (longest first to avoid partial matches)
      const sortedNouns = Object.keys(nounToDir).sort((a, b) => b.length - a.length);
      const nounPattern = sortedNouns.map((n) => n.replace(/\s/g, "\\s+")).join("|");
      const proseRegex = new RegExp(`(\\d+)\\s+(${nounPattern})(?:\\s+(?:are|is)\\s+installed|[\\.,\\n]|$)`, "gi");

      for (const m of text.matchAll(proseRegex)) {
        const num = Number(m[1]);
        const phrase = m[2].toLowerCase().replace(/\s+/g, " ");

        // Find matching noun
        for (const noun of sortedNouns) {
          if (phrase === noun) {
            const dir = nounToDir[noun];
            matchedDirs.add(dir);
            const expected = EXPECTED_COUNTS[dir as keyof typeof EXPECTED_COUNTS];
            if (expected !== undefined && num !== expected) {
              problems.push(`${file}: claims ${num} ${noun}, pinned count for ${dir}/ is ${expected}`);
            }
            break;
          }
        }
      }

      // Tripwire: detect unchecked count claims
      // If file contains number + noun/directory that we should catch but didn't, fail
      const allCountPatterns = [...Object.keys(nounToDir), ...Object.keys(EXPECTED_COUNTS)];

      for (const m of text.matchAll(/(\d+)\s+([a-z\s-]+?)(?:\s|,|\.|\n|$)/g)) {
        const phrase = m[2].toLowerCase().trim();

        // Check if this phrase is a count-bearing word we should have matched
        let shouldMatch = false;
        for (const pattern of allCountPatterns) {
          if (phrase === pattern || phrase.endsWith(` ${pattern}`)) {
            shouldMatch = true;
            break;
          }
        }

        if (shouldMatch) {
          // Find which directory this should match
          let dir: string | undefined;
          for (const noun of Object.keys(nounToDir)) {
            if (phrase === noun || phrase.endsWith(` ${noun}`)) {
              dir = nounToDir[noun];
              break;
            }
          }
          if (!dir) {
            dir = allCountPatterns.find((p) => phrase === p || phrase.endsWith(` ${p}`));
          }

          // If we should match but didn't, this is unchecked prose
          if (dir && !matchedDirs.has(dir)) {
            problems.push(
              `${file}: contains count claim "${m[1]} ${phrase}" for ${dir}/ that test does not validate`,
            );
          }
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
