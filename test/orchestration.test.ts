import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadOrchestrationDir, loadOrchestrationSkill } from "../src/orchestration.js";

const fixtures = fileURLToPath(new URL("./fixtures/orchestration/", import.meta.url));
const vars = { contentDir: "/abs/content/", engine: "godot", reviewIntensity: "lean" };

describe("loadOrchestrationSkill", () => {
  it("substitutes every known marker into the content", () => {
    const text = readFileSync(`${fixtures}gs-probe.md`, "utf8");
    const skill = loadOrchestrationSkill("gs-probe.md", text, vars);
    expect(skill.name).toBe("gs-probe");
    expect(skill.description).toBe("Orchestration probe with every substitution marker.");
    expect(skill.content).toContain("/abs/content/");
    expect(skill.content).toContain("godot");
    expect(skill.content).toContain("lean");
    expect(skill.content).not.toContain("%%GS_");
  });

  it("throws on an unsubstituted marker rather than shipping it to the model", () => {
    const text = readFileSync(`${fixtures}gs-leftover.md`, "utf8");
    expect(() => loadOrchestrationSkill("gs-leftover.md", text, vars)).toThrow(
      /%%GS_UNKNOWN_MARKER%%/,
    );
  });

  it("throws when the file name disagrees with the frontmatter name", () => {
    const text = "---\nname: gs-other\ndescription: d\n---\n\nBody.\n";
    expect(() => loadOrchestrationSkill("gs-probe.md", text, vars)).toThrow(/gs-probe/);
  });

  it("emits the registration fields the skill registry requires", () => {
    const text = readFileSync(`${fixtures}gs-probe.md`, "utf8");
    const skill = loadOrchestrationSkill("gs-probe.md", text, vars);
    expect(skill.invocation).toEqual({ modelInvocable: true, userInvocable: true });
    expect(skill.source).toBe("runtime");
    expect(skill.resourceBase).toEqual({ kind: "directory", path: "/abs/content/" });
  });
});

describe("loadOrchestrationDir", () => {
  it("throws when any file in the directory is bad", () => {
    expect(() => loadOrchestrationDir(fixtures, vars)).toThrow(/gs-leftover/);
  });
});
