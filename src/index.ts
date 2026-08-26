/**
 * dsh-game-studio: a game studio for the DeepSeek Harness.
 *
 * Mounts an isolated filesystem skill provider over this package's own
 * `content/skills/` (the human-facing studio commands) and registers the
 * model-facing orchestration skills as runtime skills with this
 * installation's absolute content path substituted in.
 *
 * @module dsh-game-studio
 */
import z from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import * as SkillFilesystem from "@deepseek-ai/dsh-skill-filesystem";
import { contentDir } from "./content.js";
import { loadOrchestrationDir } from "./orchestration.js";
import { loadCommandSkillsForModel } from "./commandSkills.js";

/** Cordis plugin identity. The patch row's `name` resolves to this module. */
export const name = "game-studio";
export const inject = ["skills"];

/** Validated plugin configuration. */
export interface ConfigType {
  engine: "auto" | "godot" | "unity" | "ue5";
  reviewIntensity: "full" | "lean" | "solo";
  watch: boolean;
  /**
   * Opt-in escape hatch. Off by default: the plugin's measured design
   * claim is 12 model-visible orchestration skills and 74 command skills
   * that cost the model catalog nothing (human-invocable only, served by
   * the filesystem provider). Turning this on re-registers all 74 command
   * skills as model-invocable runtime skills too — see
   * `commandSkills.ts` for the mechanism and why the override is
   * deliberate, not a bug.
   */
  exposeCommandSkillsToModel: boolean;
}

export const Config: Schemastery<any, ConfigType> = z.object({
  engine: z.union([
    z.const("auto"),
    z.const("godot"),
    z.const("unity"),
    z.const("ue5"),
  ]).default("auto"),
  reviewIntensity: z.union([
    z.const("full"),
    z.const("lean"),
    z.const("solo"),
  ]).default("full"),
  watch: z.boolean().default(false),
  exposeCommandSkillsToModel: z.boolean().default(false),
});

export function apply(ctx: Context, config: ConfigType): void {
  const content = contentDir();

  // The human-facing studio commands. An isolated custom root: the active
  // preset already mounts its own provider over the project and user roots,
  // and this one must not duplicate them.
  ctx.plugin(SkillFilesystem, {
    providerName: "game-studio",
    includeDefaultRoots: false,
    watch: config.watch,
    customSkillDirs: [`${content}skills/`],
  });

  // The model-facing half. Runtime skills rather than files, so this
  // installation's absolute content path can be substituted into the bodies.
  const orchestration = loadOrchestrationDir(`${content}orchestration/`, {
    contentDir: content,
    engine: config.engine,
    reviewIntensity: config.reviewIntensity,
  });
  for (const skill of orchestration) ctx.skills.register(skill);

  // Opt-in escape hatch, off by default (see ConfigType's doc comment).
  // Runtime registrations land at rank 250, which beats the filesystem
  // provider's rank-300 copy of the same skill name mounted just above —
  // each re-registration here shadows (not duplicates) its filesystem
  // twin, and the shadowed copy is logged and hidden by the skill
  // registry, not an error.
  if (config.exposeCommandSkillsToModel) {
    const commandSkills = loadCommandSkillsForModel(`${content}skills/`);
    for (const skill of commandSkills) ctx.skills.register(skill);
  }
}
