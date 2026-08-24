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
  kind: "name-mismatch" | "not-kebab" | "bad-boolean" | "missing-field" | "unparsable";
  detail: string;
}

/** The provider's own kebab-case rule for skill names. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The boolean spellings the provider accepts, case-insensitively. */
const BOOLEANS = new Set(["true", "false", "yes", "no", "on", "off", "1", "0"]);

/** The two invocation keys, in the ONLY spelling the provider accepts. */
const INVOCATION_KEYS = ["disable-model-invocation", "user-invocable"] as const;

/** Rejected camel-case spellings that would be silently ignored. */
const CAMEL_KEYS = ["disableModelInvocation", "userInvocable"] as const;

/** Split leading `---` frontmatter from a skill file. */
function splitFrontmatter(source: string): string | undefined {
  if (!source.startsWith("---")) return void 0;
  const end = source.indexOf("\n---", 3);
  if (end === -1) return void 0;
  return source.slice(source.indexOf("\n") + 1, end + 1);
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

/** Walk one skill root (one level deep) and collect every problem. */
export function checkSkillRoot(root: string): SkillProblem[] {
  const problems: SkillProblem[] = [];
  for (const entry of readdirSync(root)) {
    const dir = `${root}${entry}`;
    if (!statSync(dir).isDirectory()) continue;
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
