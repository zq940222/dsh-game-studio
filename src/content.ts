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
 * G1/G2: command-skill bodies are shipped VERBATIM by the filesystem provider —
 * there is no substitution pass and no fail-loud scan on this path, unlike the
 * orchestration loader. A `%%GS_` marker here would reach the model unchanged
 * with no error at all, and a CRLF checkout would inject `\r` throughout.
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
    if (source.includes("%%GS_")) {
      problems.push({
        dir: entry,
        kind: "marker-leak",
        detail: "a %%GS_ marker in a command skill reaches the model unsubstituted",
      });
    }
    if (source.includes("\r\n")) {
      problems.push({ dir: entry, kind: "crlf", detail: "CRLF line endings would inject \\r into model-facing text" });
    }
  }
  return problems;
}
