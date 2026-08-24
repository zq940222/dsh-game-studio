/**
 * Orchestration-skill loading. These skills are the model-facing half of the
 * studio, registered as runtime skills so this installation's absolute
 * content path can be substituted into their bodies — a filesystem skill
 * cannot know where it was installed.
 *
 * Pure functions only; no cordis import.
 *
 * @module dsh-game-studio/orchestration
 */
import { readdirSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

/**
 * One runtime skill contribution, shaped to `ctx.skills.register()`'s
 * `SkillRegistration`: the body field is `content`, and `source` is required.
 */
export interface OrchestrationSkill {
  name: string;
  description: string;
  content: string;
  source: "runtime";
  resourceBase: { kind: "directory"; path: string };
  invocation: { modelInvocable: boolean; userInvocable: boolean };
}

export interface SubstitutionVars {
  contentDir: string;
  engine: string;
  reviewIntensity: string;
}

/** Every marker this loader knows, mapped to its variable. */
const MARKERS: Record<string, keyof SubstitutionVars> = {
  "%%GS_CONTENT_DIR%%": "contentDir",
  "%%GS_ENGINE%%": "engine",
  "%%GS_REVIEW_INTENSITY%%": "reviewIntensity",
};

/** How much of the residue to quote in the thrown error — enough to name
 *  it, short enough to stay readable, and safe even when the residue is
 *  unterminated (no closing `%%` to anchor on). */
const LEFTOVER_PREVIEW_LENGTH = 40;

/** Load and substitute one orchestration file. Throws on any defect. */
export function loadOrchestrationSkill(
  fileName: string,
  text: string,
  vars: SubstitutionVars,
): OrchestrationSkill {
  // Normalize line endings before any slicing so a CRLF checkout (the
  // default on Windows with core.autocrlf=true, and this repo ships no
  // .gitattributes) never leaves a stray \r embedded in the frontmatter or,
  // worse, in the model-facing body.
  const normalized = text.replace(/\r\n/g, "\n");

  const expected = fileName.replace(/\.md$/, "");
  if (!normalized.startsWith("---")) {
    throw new Error(`orchestration ${fileName}: no leading --- frontmatter block`);
  }
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error(`orchestration ${fileName}: unterminated frontmatter block`);
  }
  const raw = normalized.slice(normalized.indexOf("\n") + 1, end + 1);
  const parsed = parseYaml(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`orchestration ${fileName}: frontmatter is not a YAML mapping`);
  }
  const front = parsed as Record<string, unknown>;
  const declared = front["name"];
  if (declared !== expected) {
    throw new Error(
      `orchestration ${fileName}: frontmatter name ${JSON.stringify(declared)} must equal "${expected}"`,
    );
  }
  const description = front["description"];
  if (typeof description !== "string" || description.length === 0) {
    throw new Error(`orchestration ${fileName}: description is missing or not a string`);
  }

  let content = normalized.slice(end + 4).replace(/^\n/, "");
  for (const [marker, key] of Object.entries(MARKERS)) {
    content = content.split(marker).join(vars[key]);
  }

  // No %%GS_ prefix may remain, unconditionally — not "any prefix shaped
  // like the three known markers." A charset-bound regex would still miss
  // a typo'd separator (hyphen, dot), a non-ASCII marker name, or an
  // unterminated marker with no closing %%. A literal substring search has
  // none of those gaps.
  const leftoverAt = content.indexOf("%%GS_");
  if (leftoverAt !== -1) {
    throw new Error(
      `orchestration ${fileName}: unsubstituted marker ${JSON.stringify(
        content.slice(leftoverAt, leftoverAt + LEFTOVER_PREVIEW_LENGTH),
      )} would reach the model`,
    );
  }

  return {
    name: expected,
    description,
    content,
    source: "runtime",
    resourceBase: { kind: "directory", path: vars.contentDir },
    invocation: { modelInvocable: true, userInvocable: true },
  };
}

/** Load every `*.md` in one orchestration directory, sorted by name. */
export function loadOrchestrationDir(
  dir: string,
  vars: SubstitutionVars,
): OrchestrationSkill[] {
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => loadOrchestrationSkill(entry, readFileSync(`${dir}${entry}`, "utf8"), vars));
}
