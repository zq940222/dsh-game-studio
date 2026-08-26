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

    // List of actual shipped directories (NOT including "excluded")
    const shippedDirs = ["roles", "templates", "rules", "engines", "handbook", "pipeline", "skills"];

    for (const file of files) {
      const text = readFileSync(`${orchDir}${file}`, "utf8");
      const lines = text.split("\n");

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        // Match table format: %%GS_CONTENT_DIR%%<dir> ... N of N installed
        for (const m of line.matchAll(
          /%%GS_CONTENT_DIR%%([a-z]+)[^\n]*?(\d+) of (\d+) installed/g,
        )) {
          const [, dir, have, total] = m;
          const expected = EXPECTED_COUNTS[dir as keyof typeof EXPECTED_COUNTS];
          if (expected === undefined) {
            problems.push(`${file}:${lineNum + 1}: claims a count for ${dir}/, which EXPECTED_COUNTS does not pin`);
          } else if (Number(have) !== expected || Number(total) !== expected) {
            problems.push(`${file}:${lineNum + 1}: claims ${have} of ${total} for ${dir}/, pinned count is ${expected}`);
          }
        }

        // Only process prose claims on installation-asserting lines
        // (Requirement 1: Consider only installation-asserting lines)
        if (!/\b(installed|installs|ships|ship|shipped)\b/.test(line)) {
          continue;
        }

        // Track what was validated on this line
        const validatedClaims = new Set<string>();

        // Match prose with explicitly listed noun patterns (Requirement 2)
        const sortedNouns = Object.keys(nounToDir).sort((a, b) => b.length - a.length);

        for (const noun of sortedNouns) {
          // Build a regex specifically for this noun, avoiding the lazy-match issue
          const nounRegex = new RegExp(`(\\d+)\\s+${noun.replace(/\s/g, "\\s+")}`, "gi");

          for (const m of line.matchAll(nounRegex)) {
            const num = Number(m[1]);
            const dir = nounToDir[noun];
            const claimKey = `${num}-${noun}`;

            validatedClaims.add(claimKey);

            const expected = EXPECTED_COUNTS[dir];
            if (expected !== undefined && num !== expected) {
              problems.push(`${file}:${lineNum + 1}: claims ${num} ${noun}, pinned count for ${dir}/ is ${expected}`);
            }
          }
        }

        // Tripwire: on installation lines, check for unmatched count claims (Requirement 2/4)
        // Look for any <number> <noun-or-dir> that appears on this line but wasn't validated
        for (const noun of sortedNouns) {
          const nounRegex = new RegExp(`(\\d+)\\s+${noun.replace(/\s/g, "\\s+")}`, "gi");

          for (const m of line.matchAll(nounRegex)) {
            const num = m[1];
            const claimKey = `${num}-${noun}`;

            if (!validatedClaims.has(claimKey)) {
              problems.push(`${file}:${lineNum + 1}: unchecked installation claim "${num} ${noun}"`);
            }
          }
        }

        // Also check for shipped directory names with numbers
        for (const dir of shippedDirs) {
          const dirRegex = new RegExp(`(\\d+)\\s+${dir}\\b`, "gi");

          for (const m of line.matchAll(dirRegex)) {
            const num = m[1];
            const claimKey = `${num}-${dir}`;

            // Check if this was validated by a noun mapping to this directory
            let found = false;
            for (const noun of sortedNouns) {
              if (nounToDir[noun] === dir && validatedClaims.has(`${num}-${noun}`)) {
                found = true;
                break;
              }
            }

            if (!found && !validatedClaims.has(claimKey)) {
              problems.push(`${file}:${lineNum + 1}: unchecked installation claim "${num} ${dir}"`);
            }
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
