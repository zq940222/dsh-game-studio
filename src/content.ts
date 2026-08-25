/**
 * Content-tree location and the fail-closed invariants the filesystem skill
 * provider enforces silently. The provider drops a malformed skill with a
 * warning rather than surfacing it, so these checks run before publishing.
 *
 * Pure functions only — this module never imports cordis, which is what
 * lets the whole set be unit-tested.
 *
 * @module dsh-game-studio/content
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

/** Absolute path to this package's `content/` tree, trailing slash included. */
export function contentDir(): string {
  // fileURLToPath returns OS-native separators; on Windows that means
  // backslashes, which breaks the forward-slash contract this function
  // documents. Normalize to forward slashes — a no-op on POSIX.
  return fileURLToPath(new URL("../content/", import.meta.url)).replace(/\\/g, "/");
}

export interface SkillProblem {
  dir: string;
  kind:
    | "name-mismatch"
    | "not-kebab"
    | "bad-boolean"
    | "missing-field"
    | "unparsable"
    | "loose-file"
    | "marker-leak"
    | "crlf";
  detail: string;
}

/** The provider's own kebab-case rule for skill names. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The boolean spellings the provider accepts, case-insensitively. */
const BOOLEANS = new Set(["true", "false", "yes", "no", "on", "off", "1", "0"]);

/** The two invocation keys, in the ONLY spelling the provider accepts. */
const INVOCATION_KEYS = ["disable-model-invocation", "user-invocable"] as const;

/**
 * Rejected camel-case spellings that would be silently ignored. Sourced
 * from the three `rejectLegacyInvocationKey` calls in
 * `dsh-skill-filesystem/lib/index.js:842-844` (identical in the installed
 * rc.8 and the harness's production rc.6) — the provider throws on any of
 * these, and the catching caller (`parseSkillFile`, :692-694) turns that
 * throw into a silent `logger.warn` + dropped skill, which is exactly the
 * loss this module exists to catch before publishing.
 */
const CAMEL_KEYS = ["disableModelInvocation", "modelInvocable", "userInvocable"] as const;

/**
 * Split leading `---` frontmatter from a skill file, mirroring the
 * provider's own `parseFrontmatter` / `findClosingFrontmatter`
 * (`dsh-skill-filesystem/lib/index.js:771-793`): each fence line must equal
 * `---` exactly, once a trailing `\r` is stripped — not merely start with
 * it. A naive substring search accepts a `----` fence (opening or closing)
 * and silently mis-slices the frontmatter; the provider rejects it outright
 * and drops the whole skill. The `\r` strip (rather than a global CRLF
 * normalize) matches the provider line-for-line and keeps this working on
 * a CRLF checkout — this repo ships no `.gitattributes`.
 */
function splitFrontmatter(source: string): string | undefined {
  const firstLineEnd = source.indexOf("\n");
  if (firstLineEnd < 0) return void 0;
  if (source.slice(0, firstLineEnd).replace(/\r$/, "") !== "---") return void 0;
  let lineStart = firstLineEnd + 1;
  while (lineStart <= source.length) {
    const nextNewline = source.indexOf("\n", lineStart);
    const lineEnd = nextNewline < 0 ? source.length : nextNewline;
    if (source.slice(lineStart, lineEnd).replace(/\r$/, "") === "---") {
      return source.slice(firstLineEnd + 1, lineStart);
    }
    if (nextNewline < 0) return void 0;
    lineStart = nextNewline + 1;
  }
  return void 0;
}

/** Check one skill directory's `SKILL.md` against every invariant. */
export function checkSkillDir(dir: string, source: string): SkillProblem[] {
  const problems: SkillProblem[] = [];
  const raw = splitFrontmatter(source);
  if (raw === void 0) {
    return [{ dir, kind: "unparsable", detail: "no leading --- frontmatter block" }];
  }
  let front: Record<string, unknown>;
  try {
    const parsed = parseYaml(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [{ dir, kind: "unparsable", detail: "frontmatter is not a YAML mapping" }];
    }
    front = parsed as Record<string, unknown>;
  } catch (error) {
    return [{ dir, kind: "unparsable", detail: `YAML error: ${String(error)}` }];
  }

  const declared = front["name"];
  if (typeof declared !== "string" || declared.length === 0) {
    problems.push({ dir, kind: "missing-field", detail: "name is missing or not a string" });
  } else {
    if (declared !== dir) {
      problems.push({
        dir,
        kind: "name-mismatch",
        detail: `frontmatter name "${declared}" != directory "${dir}"`,
      });
    }
    if (!KEBAB.test(declared)) {
      problems.push({ dir, kind: "not-kebab", detail: `name "${declared}" is not kebab-case` });
    }
  }
  if (!KEBAB.test(dir)) {
    problems.push({ dir, kind: "not-kebab", detail: `directory "${dir}" is not kebab-case` });
  }

  const description = front["description"];
  if (typeof description !== "string" || description.length === 0) {
    problems.push({ dir, kind: "missing-field", detail: "description is missing or not a string" });
  }

  for (const camel of CAMEL_KEYS) {
    if (camel in front) {
      problems.push({
        dir,
        kind: "bad-boolean",
        detail: `"${camel}" is the rejected camel-case spelling; the provider drops the whole skill`,
      });
    }
  }
  for (const key of INVOCATION_KEYS) {
    if (!(key in front)) continue;
    const value = front[key];
    if (typeof value === "boolean") continue;
    if (typeof value === "string" && BOOLEANS.has(value.toLowerCase())) continue;
    if (typeof value === "number" && (value === 0 || value === 1)) continue;
    problems.push({
      dir,
      kind: "bad-boolean",
      detail: `"${key}" is ${JSON.stringify(value)}, not an accepted boolean`,
    });
  }
  return problems;
}

/**
 * Walk one skill root (one level deep) and collect every problem.
 * @param root Absolute path to the skill root, trailing separator included
 *   — entries are joined onto it with plain string concatenation.
 */
export function checkSkillRoot(root: string): SkillProblem[] {
  const problems: SkillProblem[] = [];
  for (const entry of readdirSync(root)) {
    const dir = `${root}${entry}`;
    if (!statSync(dir).isDirectory()) {
      // The provider discovers `<root>/<name>.md` as its own skill
      // (dsh-skill-filesystem/lib/index.js:583-590), so a loose .md file
      // here — e.g. left behind by a future port script — is exactly the
      // silent-loss shape this module exists to catch. Report it rather
      // than skipping past it; a non-.md file (README, etc.) is not
      // discovered as a skill at all, so it stays silently skipped.
      if (entry.endsWith(".md")) {
        problems.push({
          dir: entry,
          kind: "loose-file",
          detail: `"${entry}" is a loose .md file directly under the skill root; move it into its own <name>/SKILL.md directory`,
        });
      }
      continue;
    }
    let source: string;
    try {
      source = readFileSync(`${dir}/SKILL.md`, "utf8");
    } catch {
      problems.push({ dir: entry, kind: "unparsable", detail: "no SKILL.md in this directory" });
      continue;
    }
    problems.push(...checkSkillDir(entry, source));
  }
  return problems;
}

/**
 * G1/G2: shared marker/CRLF scan over one file's already-read text. Command
 * skills (`checkNoMarkers`) and everything else under `content/` except
 * `orchestration/` (`checkNoMarkersTree`) are shipped VERBATIM with no
 * substitution pass and no fail-loud scan on either path, unlike the
 * orchestration loader (`orchestration.ts`'s `loadOrchestrationSkill` runs
 * a CRLF-to-LF normalize and an `assertNoLeftoverMarker` throw before
 * anything reaches a model). A `%%GS_` marker here reaches the model
 * unchanged with no error at all.
 *
 * The CRLF half checks for a bare `\r`, not the `\r\n` pair: a lone `\r`
 * with no trailing `\n` injects the exact same control byte into
 * model-facing text and is just as real a defect — checking only for the
 * pair would silently let it through.
 */
function scanForLeaks(dir: string, source: string): SkillProblem[] {
  const problems: SkillProblem[] = [];
  if (source.includes("%%GS_")) {
    problems.push({
      dir,
      kind: "marker-leak",
      detail: "a %%GS_ marker in shipped content reaches the model unsubstituted",
    });
  }
  if (source.includes("\r")) {
    problems.push({
      dir,
      kind: "crlf",
      detail: "a \\r byte (CRLF or a bare CR) would inject into model-facing text",
    });
  }
  return problems;
}

/**
 * G1/G2 over a skills root: `<root>/<name>/SKILL.md`, one directory per skill.
 * @param root - a skills root, trailing slash included.
 * @returns one problem per offending file.
 */
export function checkNoMarkers(root: string): SkillProblem[] {
  const problems: SkillProblem[] = [];
  for (const entry of readdirSync(root)) {
    const dir = `${root}${entry}`;
    if (!statSync(dir).isDirectory()) continue;
    let source: string;
    try {
      source = readFileSync(`${dir}/SKILL.md`, "utf8");
    } catch {
      continue;
    }
    problems.push(...scanForLeaks(entry, source));
  }
  return problems;
}

/**
 * G1/G2 over any other content root, at any nesting depth: every `.md`
 * file under `root`, recursively. This is the shape everything under
 * `content/` uses once you leave `skills/` (dedicated coverage via
 * `checkSkillRoot`/`checkNoMarkers` above, including the provider's own
 * structural invariants, not just G1/G2) and `orchestration/` (excluded
 * by the caller — loaded through `orchestration.ts`, which normalizes
 * CRLF and fail-loud-scans for `%%GS_` residue itself, and which
 * legitimately CONTAINS `%%GS_` markers by design, before substitution).
 *
 * Every one of those directories is model-facing text read verbatim at
 * an absolute path, with no normalizing loader in front of it — the same
 * three facts that justified `content/roles/` coverage apply unchanged
 * to `content/handbook/`, `content/templates/`, `content/pipeline/`, and
 * `content/engines/`. The shapes already differ (`roles/` is flat,
 * `engines/<engine>/**` nests one level deeper, and future directories
 * may nest differently still), so this walks recursively rather than
 * assuming any fixed depth — a flat root is simply a tree with no
 * subdirectories to recurse into, so this one function covers both.
 * @param root - a content root, trailing slash included.
 * @returns one problem per offending file. `dir` is the path relative to
 *   `root` (forward-slash-joined), so a nested file stays identifiable —
 *   e.g. "some-engine/sub/doc.md", not just "doc.md".
 */
export function checkNoMarkersTree(root: string): SkillProblem[] {
  const problems: SkillProblem[] = [];
  const walk = (relDir: string): void => {
    for (const entry of readdirSync(`${root}${relDir}`)) {
      const relPath = `${relDir}${entry}`;
      if (statSync(`${root}${relPath}`).isDirectory()) {
        walk(`${relPath}/`);
        continue;
      }
      if (!entry.endsWith(".md")) continue;
      problems.push(...scanForLeaks(relPath, readFileSync(`${root}${relPath}`, "utf8")));
    }
  };
  walk("");
  return problems;
}
