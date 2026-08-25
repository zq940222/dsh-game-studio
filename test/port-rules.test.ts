import { describe, expect, it } from "vitest";
import { COMMANDS, EXCLUDED_DOCS, ROLES, UPSTREAM_SHA, isCommand, isRole } from "../tools/port/inventory.mjs";

describe("inventory", () => {
  it("pins the upstream commit the port reproduces from", () => {
    expect(UPSTREAM_SHA).toBe("984023d");
  });

  it("carries exactly the 73 upstream command names, sorted and unique", () => {
    expect(COMMANDS).toHaveLength(73);
    expect([...new Set(COMMANDS)]).toHaveLength(73);
    expect([...COMMANDS].sort()).toEqual([...COMMANDS]);
    expect(COMMANDS).toContain("start");
    expect(COMMANDS).toContain("vertical-slice");
    expect(COMMANDS).not.toContain("gs-start");
  });

  it("carries 49 roles split 3 directors / 8 leads / 38 specialists", () => {
    const names = Object.keys(ROLES);
    expect(names).toHaveLength(49);
    const byTier = (t: number) => names.filter((n) => ROLES[n]!.tier === t);
    expect(byTier(1)).toHaveLength(3);
    expect(byTier(2)).toHaveLength(8);
    expect(byTier(3)).toHaveLength(38);
    expect(byTier(1).sort()).toEqual(["creative-director", "producer", "technical-director"]);
  });

  it("excludes exactly the nine Claude Code specific documents", () => {
    expect(EXCLUDED_DOCS).toHaveLength(9);
    expect(EXCLUDED_DOCS).toContain("hooks-reference.md");
    expect(EXCLUDED_DOCS).toContain("hooks-reference/pre-push-test-gate.md");
    expect(EXCLUDED_DOCS).toContain("settings-local-template.md");
    expect(EXCLUDED_DOCS).toContain("CLAUDE-local-template.md");
    expect(EXCLUDED_DOCS.filter((d) => d.startsWith("hooks-reference/"))).toHaveLength(6);
  });

  it("answers membership without substring false positives", () => {
    expect(isCommand("start")).toBe(true);
    expect(isCommand("star")).toBe(false);
    expect(isCommand("starts")).toBe(false);
    expect(isRole("gameplay-programmer")).toBe(true);
    expect(isRole("gameplay")).toBe(false);
  });

  it("assigns each role to a non-empty department", () => {
    Object.entries(ROLES).forEach(([name, role]) => {
      expect(role.department).toBeTruthy();
      expect(typeof role.department).toBe("string");
      expect(role.department.length).toBeGreaterThan(0);
    });
  });

  it("classifies roles coherently by department", () => {
    // Directors resolve to leadership
    expect(ROLES["producer"]!.department).toBe("leadership");

    // Audio roles both resolve to audio
    expect(ROLES["audio-director"]!.department).toBe("audio");
    expect(ROLES["sound-designer"]!.department).toBe("audio");

    // Design-domain roles resolve to design
    expect(ROLES["game-designer"]!.department).toBe("design");
    expect(ROLES["level-designer"]!.department).toBe("design");
    expect(ROLES["ux-designer"]!.department).toBe("design");

    // Engineering roles resolve to engineering
    expect(ROLES["gameplay-programmer"]!.department).toBe("engineering");
  });

  it("deep-freezes nested role objects to prevent mutation", () => {
    const role = ROLES["gameplay-programmer"]!;
    expect(() => {
      (role as any).tier = 99;
    }).toThrow();
  });
});
