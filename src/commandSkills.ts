/**
 * Command-skill loading for the `exposeCommandSkillsToModel` opt-in escape
 * hatch (see `index.ts`'s `Config` for the option itself).
 *
 * The studio's central design claim is that its 74 command skills under
 * `content/skills/<name>/SKILL.md` cost the model catalog nothing: each
 * one's own frontmatter declares `disable-model-invocation: true` /
 * `user-invocable: true`, and the filesystem provider mounted in
 * `index.ts` honors that at rank 300, so only the 12 orchestration skills
 * are ever model-visible by default.
 *
 * This module exists ONLY to let a user opt out of that claim for their
 * own installation. When `exposeCommandSkillsToModel` is on, `index.ts`
 * calls `loadCommandSkillsForModel` to re-read every command skill and
 * re-register it as a runtime skill with `modelInvocable: true` forced —
 * deliberately overriding what the file's own `disable-model-invocation`
 * frontmatter says. That override is not a bug; it is the entire point of
 * the flag. Runtime registrations land at rank 250
 * (`RUNTIME_RANK` in `@deepseek-ai/dsh-skill`'s registry), which beats the
 * filesystem provider's rank-300 copy of the same name, so the runtime
 * copy shadows (not duplicates) the provider's copy — the shadowed copy
 * is logged and hidden by the registry, not an error.
 *
 * Pure functions only; no cordis import (mirrors orchestration.ts).
 *
 * @module dsh-game-studio/commandSkills
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { OrchestrationSkill } from "./orchestration.js";

/**
 * Parse one command skill's `SKILL.md` into a model-invocable runtime
 * registration, shaped identically to `ctx.skills.register()`'s
 * `SkillRegistration` (body is `content`, `source` is required) — the
 * same shape `orchestration.ts`'s `OrchestrationSkill` already captures,
 * reused here rather than duplicated.
 * @param dirName Skill directory name (e.g. `gs-adopt`), used only in
 *   error messages.
 * @param dirPath Absolute path to the skill's own directory, trailing
 *   separator included. Becomes `resourceBase.path`, so the skill's
 *   `references/`, `scripts/`, `assets/` resolve exactly as they do
 *   under the filesystem provider's own `resourceBase` (each skill's own
 *   directory, not the shared content root orchestration skills use).
 * @param source Raw `SKILL.md` text.
 */
export function loadCommandSkillForModel(
  dirName: string,
  dirPath: string,
  source: string,
): OrchestrationSkill {
  // Same CRLF guard as loadOrchestrationSkill: a Windows checkout with no
  // .gitattributes must not leak a stray \r into model-facing text.
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---")) {
    throw new Error(`command skill ${dirName}: no leading --- frontmatter block`);
  }
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error(`command skill ${dirName}: unterminated frontmatter block`);
  }
  const raw = normalized.slice(normalized.indexOf("\n") + 1, end + 1);
  const parsed = parseYaml(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`command skill ${dirName}: frontmatter is not a YAML mapping`);
  }
  const front = parsed as Record<string, unknown>;
  const declaredName = front["name"];
  if (typeof declaredName !== "string" || declaredName.length === 0) {
    throw new Error(`command skill ${dirName}: frontmatter name is missing or not a string`);
  }
  const description = front["description"];
  if (typeof description !== "string" || description.length === 0) {
    throw new Error(`command skill ${dirName}: description is missing or not a string`);
  }
  const content = normalized.slice(end + 4).replace(/^\n/, "");

  // Command skills carry `metadata` (argument-hint, model, agent — see
  // any file under content/skills/*/SKILL.md) that user invocation
  // already depends on today via the filesystem provider. This
  // re-registration is meant to ADD model invocability on top of the
  // existing user-invocable behavior, not narrow it — dropping metadata
  // here would silently degrade the very /gs-* commands this flag was
  // never meant to touch, the moment the runtime copy's rank-250 shadows
  // the provider's rank-300 copy. Same reasoning for whenToUse, even
  // though no shipped command skill currently declares one.
  const rawMetadata = front["metadata"];
  const metadata =
    rawMetadata !== null && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
      ? (rawMetadata as Record<string, unknown>)
      : undefined;
  const rawWhenToUse = front["whenToUse"];
  const whenToUse = typeof rawWhenToUse === "string" ? rawWhenToUse : undefined;

  return {
    name: declaredName,
    description,
    content,
    source: "runtime",
    resourceBase: { kind: "directory", path: dirPath },
    // Deliberate override — see module doc. This file's own frontmatter
    // says disable-model-invocation: true / user-invocable: true; the
    // whole reason this loader runs is to expose it to the model anyway.
    //
    // Both booleans are hardcoded, not read from `front` — this ignores
    // whatever the file's own frontmatter actually declares for either
    // key. Harmless today: all 74 shipped command skills uniformly
    // declare `disable-model-invocation: true` + `user-invocable: true`,
    // so forcing modelInvocable true only ever ADDS model access on top
    // of unchanged user access. `checkSkillDir` (src/content.ts) only
    // validates that these keys are well-formed booleans, never their
    // value, so nothing else in this codebase would catch it if that
    // uniformity stopped holding. A future command skill authored with
    // `user-invocable: false` (e.g. something meant to be model-only)
    // would be silently forced back to userInvocable: true the moment
    // this flag is on — this hardcode has no way to tell "override
    // model-invocability" apart from "override user-invocability too".
    invocation: { modelInvocable: true, userInvocable: true },
    ...(metadata !== undefined ? { metadata } : {}),
    ...(whenToUse !== undefined ? { whenToUse } : {}),
  };
}

/**
 * Load every command skill under `skillsRoot` (one directory per skill,
 * `<name>/SKILL.md`), sorted by directory name — mirrors
 * `loadOrchestrationDir`'s shape.
 * @param skillsRoot Absolute path to `content/skills/`, trailing
 *   separator included — entries are joined onto it with plain string
 *   concatenation.
 */
export function loadCommandSkillsForModel(skillsRoot: string): OrchestrationSkill[] {
  return readdirSync(skillsRoot)
    .filter((entry) => statSync(`${skillsRoot}${entry}`).isDirectory())
    .sort()
    .map((entry) => {
      const dirPath = `${skillsRoot}${entry}/`;
      return loadCommandSkillForModel(entry, dirPath, readFileSync(`${dirPath}SKILL.md`, "utf8"));
    });
}
