/**
 * Frontmatter parsing for the panel catalog generator, plus the aggregate
 * `buildCatalog` that assembles the 49 role briefs and 74 command skills
 * shipped under `content/` into the flat, pre-sorted shape the browser
 * panel renders with no sorting or fs access of its own.
 *
 * "Pure" here means the same thing it means in `src/content.ts`: no
 * cordis import, so the whole set is unit-testable without booting the
 * plugin. It does not mean no filesystem access — `buildCatalog` reads
 * the same two content roots `src/content.ts` and `src/commandSkills.ts`
 * already read at runtime, just at generation time instead.
 *
 * @module dsh-game-studio/tools/catalog/parse
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

/**
 * @typedef {{ role: string, description: string, tier: number, department: string, modelTier: string, briefPath: string }} CatalogRole
 * @typedef {{ name: string, description: string, phase: string }} CatalogCommand
 * @typedef {{ roles: CatalogRole[], commands: CatalogCommand[] }} Catalog
 */

/** The seven pipeline phases, in sequence order — verbatim from `gs-pipeline.md`'s table. */
const PHASE_ORDER = ["Concept", "Design", "Architecture", "Sprint", "QA", "Polish", "Release"];

/** Task 1's hand-maintained command -> phase map, the default `parsePhaseMap` input. */
const DEFAULT_PHASE_MAP_PATH = fileURLToPath(new URL("../port/static/command-phases.md", import.meta.url));

/**
 * Pull the leading `---`-fenced YAML block out of a markdown file's text.
 * Deliberately simpler than `src/content.ts`'s `splitFrontmatter`: that
 * function mirrors the filesystem skill provider's own fence-matching
 * line-for-line because a mismatch there means the provider silently
 * drops a skill. This module only ever reads content this repo already
 * ships and that `pnpm lint:content` already validates against that same
 * provider behavior, so a plain anchored regex is enough here — this is
 * a generation-time reader, not a second copy of the provider's contract.
 * @param {string} text
 * @returns {string} the raw YAML between the fences.
 */
function extractFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) {
    throw new Error("no leading --- frontmatter block found");
  }
  return match[1];
}

/**
 * Parse one role brief's frontmatter. Role briefs use `role:`, never
 * `name:` — measured 49/49 vs. 0/49 across the shipped content — so a
 * missing `role` key throws rather than silently emitting an undefined
 * name into the catalog; see the module doc for why that's deliberate.
 * @param {string} text full file contents, frontmatter plus body.
 * @returns {{ role: string, description: string, tier: number, department: string, modelTier: string }}
 */
export function parseRoleFrontmatter(text) {
  const front = parseYaml(extractFrontmatter(text)) ?? {};
  const role = front["role"];
  if (typeof role !== "string" || role.length === 0) {
    throw new Error('role frontmatter is missing the required "role:" key (found "name:" instead? that key is never used — see global-constraints.md)');
  }
  return {
    role,
    description: front["description"],
    tier: Number(front["tier"]),
    department: front["department"],
    modelTier: front["model-tier"],
  };
}

/**
 * Parse one command skill's `SKILL.md` frontmatter.
 * @param {string} text full file contents, frontmatter plus body.
 * @returns {{ name: string, description: string }}
 */
export function parseCommandFrontmatter(text) {
  const front = parseYaml(extractFrontmatter(text)) ?? {};
  return {
    name: front["name"],
    description: front["description"],
  };
}

/**
 * Parse `command-phases.md`'s two-column `| gs-xxx | Phase |` table,
 * ignoring prose, headings, and the header/separator rows — same row
 * shape `test/command-phases-truth.test.ts` already validates the file
 * against.
 * @param {string} text
 * @returns {Map<string, string>} command name -> phase name, in file order.
 */
export function parsePhaseMap(text) {
  const map = new Map();
  for (const m of text.matchAll(/^\|\s*(gs-[a-z0-9-]+)\s*\|\s*([A-Za-z]+)\s*\|\s*$/gm)) {
    map.set(m[1], m[2]);
  }
  return map;
}

/**
 * Assemble the full panel catalog from the two shipped content roots and
 * the command/phase map, fully sorted so the client renders in order with
 * no sorting of its own.
 *
 * Roles: `content/roles/*.md`, one file per role, sorted by `department`,
 * then `tier` ascending, then `role` alphabetically. `roles/_index.md` is
 * a port-generated index (see `templates/_index.md`'s own precedent) with
 * no `role:` key, so it is filtered out by filename *before* parsing —
 * `parseRoleFrontmatter` throws on a missing `role:` key by design, and
 * that throw must stay reserved for a genuinely broken role brief.
 *
 * Commands: `content/skills/`, one `gs-` prefixed directory per command, guarded
 * with `isDirectory()` rather than a `gs-` name filter — the same guard
 * `src/commandSkills.ts`'s `loadCommandSkillsForModel` and
 * `tools/port/port.mjs`'s skill-source scan both already use, and the
 * same shape `src/content.ts`'s `"loose-file"` problem kind exists to
 * catch: a stray `.md` file dropped directly under the skills root.
 * Sorted by the phase's position in the 7-phase sequence, then `name`
 * alphabetically.
 *
 * @param {{ rolesDir: string, skillsDir: string, phaseMapText?: string }} params
 *   `rolesDir`/`skillsDir` are absolute paths with no trailing separator.
 *   `phaseMapText` defaults to `tools/port/static/command-phases.md`'s
 *   contents when omitted.
 * @returns {Catalog}
 */
export function buildCatalog({ rolesDir, skillsDir, phaseMapText }) {
  const phaseMap = parsePhaseMap(phaseMapText ?? readFileSync(DEFAULT_PHASE_MAP_PATH, "utf8"));

  const roles = readdirSync(rolesDir)
    .filter((entry) => entry.endsWith(".md") && entry !== "_index.md")
    .map((entry) => {
      const parsed = parseRoleFrontmatter(readFileSync(`${rolesDir}/${entry}`, "utf8"));
      // Content-relative, not absolute: the absolute content root is a
      // per-installation value (differs on every machine) and must never
      // be baked into a client bundle.
      return { ...parsed, briefPath: `roles/${parsed.role}.md` };
    })
    .sort(
      (a, b) =>
        a.department.localeCompare(b.department) || a.tier - b.tier || a.role.localeCompare(b.role),
    );

  const commands = readdirSync(skillsDir)
    .filter((entry) => statSync(`${skillsDir}/${entry}`).isDirectory())
    .map((entry) => {
      const parsed = parseCommandFrontmatter(readFileSync(`${skillsDir}/${entry}/SKILL.md`, "utf8"));
      return { name: parsed.name, description: parsed.description, phase: phaseMap.get(parsed.name) };
    })
    .sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || a.name.localeCompare(b.name));

  return { roles, commands };
}
