import { describe, expect, it } from "vitest";
import { parseRoleFrontmatter, parseCommandFrontmatter, parsePhaseMap, buildCatalog } from "../tools/catalog/parse.mjs";
import { contentDir } from "../src/content.js";

describe("parseRoleFrontmatter", () => {
  it("reads the five keys that are 49/49 covered", () => {
    const text = [
      "---",
      "role: gameplay-programmer",
      "description: Implements game mechanics.",
      "tier: 3",
      "department: engineering",
      "model-tier: sonnet",
      "---",
      "",
      "# body",
    ].join("\n");
    expect(parseRoleFrontmatter(text)).toEqual({
      role: "gameplay-programmer",
      description: "Implements game mechanics.",
      tier: 3,
      department: "engineering",
      modelTier: "sonnet",
    });
  });

  it("rejects a brief using `name` instead of `role`", () => {
    const text = ["---", "name: x", "description: y", "tier: 3", "department: z", "model-tier: sonnet", "---"].join("\n");
    expect(() => parseRoleFrontmatter(text)).toThrow(/role/);
  });
});

describe("parsePhaseMap", () => {
  it("reads two-column rows and ignores prose", () => {
    const text = ["# heading", "", "prose line", "", "| Command | Phase |", "|---|---|", "| gs-a | Concept |", "| gs-b | Release |"].join("\n");
    expect([...parsePhaseMap(text)]).toEqual([["gs-a", "Concept"], ["gs-b", "Release"]]);
  });
});

describe("buildCatalog over the real shipped content", () => {
  const catalog = buildCatalog({
    rolesDir: `${contentDir()}roles`,
    skillsDir: `${contentDir()}skills`,
    phaseMapText: undefined, // loaded from disk by default
  });

  it("has 49 roles and 74 commands", () => {
    expect(catalog.roles).toHaveLength(49);
    expect(catalog.commands).toHaveLength(74);
  });

  it("never emits a role without a department or tier", () => {
    const bad = catalog.roles.filter((r) => !r.department || !r.tier);
    expect(bad).toEqual([]);
  });

  it("never emits a command without a phase", () => {
    const bad = catalog.commands.filter((c) => !c.phase);
    expect(bad).toEqual([]);
  });

  it("excludes roles/_index.md, which is generated, not a role", () => {
    expect(catalog.roles.map((r) => r.role)).not.toContain("_index");
  });

  it("computes briefPath as content-relative, not absolute", () => {
    const role = catalog.roles.find((r) => r.role === "gameplay-programmer");
    expect(role?.briefPath).toBe("roles/gameplay-programmer.md");
  });

  // RolesTab.tsx's toDepartmentGroups and CommandsTab.tsx's toPhaseGroups
  // both start a new group only when the key changes from the previous
  // element — correct only because these sorts (above) keep same-key rows
  // contiguous. A comparator change that broke contiguity would silently
  // render duplicate group headers instead of failing loudly, so this
  // guards the property those two components actually depend on: the
  // number of contiguous runs must equal the number of distinct keys.
  it("keeps roles department-contiguous, which RolesTab's grouping depends on", () => {
    const runs = catalog.roles.filter((r, i) => i === 0 || r.department !== catalog.roles[i - 1]!.department).length;
    expect(runs).toBe(new Set(catalog.roles.map((r) => r.department)).size);
  });

  it("keeps commands phase-contiguous, which CommandsTab's grouping depends on", () => {
    const runs = catalog.commands.filter((c, i) => i === 0 || c.phase !== catalog.commands[i - 1]!.phase).length;
    expect(runs).toBe(new Set(catalog.commands.map((c) => c.phase)).size);
  });
});
