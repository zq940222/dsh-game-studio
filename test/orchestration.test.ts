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

  // The check must be a literal %%GS_ prefix scan, not a charset-bound
  // regex — round 1 widened [A-Z_] to [A-Za-z0-9_] and that still missed a
  // hyphen, a dot, a non-ASCII marker name, and an unterminated marker with
  // no closing %%. Every one of these must still throw.
  it.each([
    ["lowercase", "%%GS_content_dir%%"],
    ["digit-bearing", "%%GS_ENGINE2%%"],
    ["mixed-case", "%%GS_Engine%%"],
    ["hyphenated", "%%GS_CONTENT-DIR%%"],
    ["dotted", "%%GS_REVIEW.INTENSITY%%"],
    ["non-ASCII", "%%GS_引擎%%"],
    ["unterminated", "%%GS_engine"],
  ])("throws on a %s leftover marker with no charset or termination assumption", (_label, marker) => {
    const text = `---\nname: gs-case\ndescription: d\n---\n\nBody ${marker} end.\n`;
    expect(() => loadOrchestrationSkill("gs-case.md", text, vars)).toThrow(marker);
  });

  it("throws when the file name disagrees with the frontmatter name", () => {
    const text = "---\nname: gs-other\ndescription: d\n---\n\nBody.\n";
    expect(() => loadOrchestrationSkill("gs-probe.md", text, vars)).toThrow(/gs-probe/);
  });

  // description is read at parse time and returned unmodified unless it
  // goes through the same substitution as content — and description is
  // what sits in EVERY session's skill catalog, so it is the one field a
  // leaked marker is guaranteed to be seen in.
  it("substitutes markers in the description, not just the content", () => {
    const text =
      "---\nname: gs-case\ndescription: Studio content at %%GS_CONTENT_DIR%% here.\n---\n\nBody.\n";
    const skill = loadOrchestrationSkill("gs-case.md", text, vars);
    expect(skill.description).toBe("Studio content at /abs/content/ here.");
    expect(skill.description).not.toContain("%%GS_");
  });

  it("throws on an unsubstituted marker in the description rather than shipping it to the model", () => {
    const text =
      "---\nname: gs-case\ndescription: Studio content at %%GS_UNKNOWN_MARKER%% here.\n---\n\nBody.\n";
    expect(() => loadOrchestrationSkill("gs-case.md", text, vars)).toThrow(
      /%%GS_UNKNOWN_MARKER%%/,
    );
  });

  it("emits the registration fields the skill registry requires", () => {
    const text = readFileSync(`${fixtures}gs-probe.md`, "utf8");
    const skill = loadOrchestrationSkill("gs-probe.md", text, vars);
    expect(skill.invocation).toEqual({ modelInvocable: true, userInvocable: true });
    expect(skill.source).toBe("runtime");
    expect(skill.resourceBase).toEqual({ kind: "directory", path: "/abs/content/" });
  });

  it("normalizes CRLF line endings so no stray \r reaches the model", () => {
    // Normalize the on-disk fixture to LF *first*: on a fresh checkout on
    // this machine (core.autocrlf=true, no .gitattributes) the fixture may
    // already arrive as CRLF, and building the CRLF variant from un-normalized
    // text would double up separators into \r\r\n and leave a stray \r behind
    // — exactly the bug this test exists to catch, so the test must not
    // reintroduce it in its own setup.
    const onDisk = readFileSync(`${fixtures}gs-probe.md`, "utf8");
    const lf = onDisk.replace(/\r\n/g, "\n");
    const crlf = lf.replace(/\n/g, "\r\n");
    const skill = loadOrchestrationSkill("gs-probe.md", crlf, vars);
    expect(skill.name).toBe("gs-probe");
    expect(skill.description).toBe("Orchestration probe with every substitution marker.");
    expect(skill.content).not.toContain("\r");
    expect(skill.content).toContain("/abs/content/");
  });
});

describe("loadOrchestrationDir", () => {
  it("throws when any file in the directory is bad", () => {
    expect(() => loadOrchestrationDir(fixtures, vars)).toThrow(/gs-leftover/);
  });
});
