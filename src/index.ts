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

/** Cordis plugin identity. The patch row's `name` resolves to this module. */
export const name = "game-studio";
export const inject = ["skills"];

/** Validated plugin configuration. */
export interface ConfigType {
  engine: "auto" | "godot" | "unity" | "ue5";
  reviewIntensity: "full" | "lean" | "solo";
  watch: boolean;
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
});

export function apply(_ctx: Context, _config: ConfigType): void {
  // Task 3 mounts the command-skill provider; Task 5 registers the
  // orchestration skills. An empty apply keeps the row loadable meanwhile.
}
