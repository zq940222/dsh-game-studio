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

// --- Deny-unknown, not allow-known ---------------------------------------
//
// Earlier versions of this test were an ALLOW-KNOWN whitelist: a hardcoded
// set of nouns and directory names, matched against the text. A whitelist
// can prove a claim it recognizes is wrong; it structurally cannot prove
// that a claim it does not recognize even exists. Every round of patching
// the whitelist to catch one bad phrasing let a different phrasing through
// silently (see task-18-report.md, rounds 1-2, for the two ways this
// failed in practice).
//
// This version inverts the default. On any line that asserts installation,
// EVERY number on that line must be accounted for: either a validating
// matcher below recognizes it and checks it against the pinned count, or
// it is a reviewed, named exception, or the test FAILS as "unaccounted
// for". A phrasing nobody anticipated therefore cannot pass silently — it
// fails loud, and whoever wrote it must either phrase it recognizably or
// add a reviewed exception.
//
// Out of scope, deliberately not chased: spelled-out numbers ("forty-nine
// role briefs are installed") — this test only looks for digit runs.

describe("orchestration skills tell the truth about what ships", () => {
  const orchDir = `${contentDir()}orchestration/`;
  const files = readdirSync(orchDir).filter((f) => f.endsWith(".md"));

  it("has orchestration files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every count on an installation-asserting line is validated against the pinned count, or a named exception", () => {
    const problems: string[] = [];

    // Prose noun phrases that map to a shipped directory's pinned count.
    // Deliberately plural-only, matching how every real claim in this
    // repo's content is phrased ("49 role briefs", "40 document
    // templates", "11 path-scoped coding standards"): a bare singular
    // ("1 role brief") never states a total-count claim worth validating,
    // and keeping a singular entry around only gives a shorter noun room
    // to false-positive-match as a prefix inside an unrelated longer
    // phrase (e.g. "role brief" inside "4 role brief summaries" — the
    // Critical regression from round 2, see task-18-report.md).
    //
    // Do NOT widen this map to chase phrasings. With the sweep below, any
    // claim this map doesn't recognize fails loudly as unaccounted for —
    // that is the safe outcome, not a gap to patch here.
    const nounToDir: Record<string, string> = {
      "role briefs": "roles",
      "document templates": "templates",
      "path-scoped coding standards": "rules",
      "coding standards": "rules",
    };
    // Longest first so "path-scoped coding standards" is not *also*
    // re-matched as the shorter "coding standards" (in practice the
    // digit-adjacency requirement in each noun's own regex already
    // prevents that here, since "coding" in "path-scoped coding
    // standards" is never immediately preceded by a digit — but sorting
    // longest-first keeps that true by construction, not by accident).
    const sortedNouns = Object.keys(nounToDir).sort((a, b) => b.length - a.length);

    // Numbers that sit on a qualifying (installation-asserting) line but
    // are NOT installation-count claims. Adding an entry here is a
    // deliberate, reviewed act — never a way to silence a failure. Each
    // entry is matched against its exact surrounding substring, not the
    // bare number, so editing the line invalidates the exception and
    // forces re-confirmation here.
    const acknowledgedExceptions: Array<{ file: string; substring: string; reason: string }> = [
      {
        file: "gs-studio.md",
        substring: "Phase 2 ships the full studio",
        reason: "the 2 is a project phase number, not a count of shipped files",
      },
      {
        file: "gs-studio.md",
        substring: "The 7-phase workflow catalog",
        reason: "7 is the pipeline's phase count, not a file count",
      },
      {
        file: "gs-studio.md",
        substring: "74 of 74 installed (73 ported + `gs-ping`)",
        reason: "73 is the ported-vs-first-party breakdown of the validated 74, not a separate claim",
      },
    ];

    for (const file of files) {
      const text = readFileSync(`${orchDir}${file}`, "utf8");
      const lines = text.split("\n");

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum]!;

        // Only installation-asserting lines are scanned at all. This is
        // what keeps "Phase 1", "three to five pillars", "the pipeline
        // has 7 phases", and "a typical raid party has 4 roles" from
        // ever being examined — none of them assert that something is
        // installed/shipped.
        if (!/\b(installed|installs|ships|ship|shipped|bundles|includes)\b/i.test(line)) {
          continue;
        }

        // consumed[i] === true: the character at offset i in `line` was
        // part of a digit run a validating matcher below already
        // accounted for — regardless of whether the value it captured
        // turned out to match the pinned count. A mismatch is reported
        // once, by the matcher that found it; it must not also show up
        // as "unaccounted for" in the sweep.
        const consumed: boolean[] = new Array(line.length).fill(false);
        const consume = (range: [number, number] | undefined) => {
          if (!range) return;
          for (let i = range[0]; i < range[1]; i++) consumed[i] = true;
        };

        // --- Validating matcher 1: table form ---
        // %%GS_CONTENT_DIR%%<dir> ... N of N installed
        for (const m of line.matchAll(
          /%%GS_CONTENT_DIR%%([a-z]+)[^\n]*?(\d+) of (\d+) installed/gd,
        )) {
          const [, dir, have, total] = m;
          consume(m.indices![2]);
          consume(m.indices![3]);
          const expected = EXPECTED_COUNTS[dir as keyof typeof EXPECTED_COUNTS];
          if (expected === undefined) {
            problems.push(`${file}:${lineNum + 1}: claims a count for ${dir}/, which EXPECTED_COUNTS does not pin`);
          } else if (Number(have) !== expected || Number(total) !== expected) {
            problems.push(`${file}:${lineNum + 1}: claims ${have} of ${total} for ${dir}/, pinned count is ${expected}`);
          }
        }

        // --- Validating matcher 2: prose form ---
        // "N <noun>" where <noun> maps to a directory. The trailing \b
        // is load-bearing: without it, "role brief" matches as a raw
        // prefix of "role briefs" (round 2's Critical regression).
        for (const noun of sortedNouns) {
          const nounRegex = new RegExp(`(\\d+)\\s+${noun.replace(/\s/g, "\\s+")}\\b`, "gid");
          for (const m of line.matchAll(nounRegex)) {
            const num = m[1]!;
            consume(m.indices![1]);
            const dir = nounToDir[noun]!;
            const expected = EXPECTED_COUNTS[dir as keyof typeof EXPECTED_COUNTS];
            if (expected !== undefined && Number(num) !== expected) {
              problems.push(`${file}:${lineNum + 1}: claims ${num} ${noun}, pinned count for ${dir}/ is ${expected}`);
            }
          }
        }

        // --- The sweep: deny unknown ---
        // Every digit run on this line must now either be consumed by a
        // validating matcher above, or be a named, reviewed exception.
        // Anything else is a claim in a phrasing this test does not
        // recognize, and it fails loud rather than passing silently.
        for (const m of line.matchAll(/\d+/gd)) {
          const [start, end] = m.indices![0]!;
          if (consumed.slice(start, end).every(Boolean)) continue;

          const exempt = acknowledgedExceptions.some((ex) => {
            if (ex.file !== file) return false;
            const at = line.indexOf(ex.substring);
            return at !== -1 && start >= at && end <= at + ex.substring.length;
          });
          if (exempt) continue;

          problems.push(
            `${file}:${lineNum + 1}: unaccounted installation claim "${m[0]}" in "${line.trim()}"`,
          );
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
