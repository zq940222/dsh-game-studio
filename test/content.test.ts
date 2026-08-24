import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkSkillDir, checkSkillRoot, contentDir } from "../src/content.js";

const fixtures = fileURLToPath(new URL("./fixtures/skills/", import.meta.url));
const read = (dir: string) => readFileSync(`${fixtures}${dir}/SKILL.md`, "utf8");

describe("checkSkillDir", () => {
  it("accepts a well-formed command skill", () => {
    expect(checkSkillDir("gs-good", read("gs-good"))).toEqual([]);
  });

  it("catches a frontmatter name that disagrees with the directory", () => {
    const problems = checkSkillDir("gs-mismatch", read("gs-mismatch"));
    expect(problems.map((p) => p.kind)).toContain("name-mismatch");
  });

  it("catches a non-kebab-case name", () => {
    const problems = checkSkillDir("gs-CamelCase", read("gs-CamelCase"));
    expect(problems.map((p) => p.kind)).toContain("not-kebab");
  });

  it("catches the rejected camel-case invocation key and a non-boolean value", () => {
    const problems = checkSkillDir("gs-badbool", read("gs-badbool"));
    expect(problems.map((p) => p.kind)).toContain("bad-boolean");
  });

  it("catches a missing description", () => {
    const problems = checkSkillDir("gs-x", "---\nname: gs-x\n---\n\nBody.\n");
    expect(problems.map((p) => p.kind)).toContain("missing-field");
  });

  it("catches unparsable frontmatter", () => {
    const problems = checkSkillDir("gs-x", "no frontmatter here\n");
    expect(problems.map((p) => p.kind)).toContain("unparsable");
  });
});

describe("checkSkillRoot", () => {
  it("reports every bad fixture and nothing for the good one", () => {
    const problems = checkSkillRoot(fixtures);
    // Deduplicated: gs-CamelCase and gs-badbool each produce TWO problems,
    // so compare the set of offending directories, not the problem count.
    expect([...new Set(problems.map((p) => p.dir))].sort()).toEqual(
      ["gs-CamelCase", "gs-badbool", "gs-mismatch"].sort(),
    );
    expect(problems.some((p) => p.dir === "gs-good")).toBe(false);
  });
});

describe("contentDir", () => {
  it("points at this package's own content directory", () => {
    expect(contentDir().endsWith("/")).toBe(true);
    expect(existsSync(contentDir())).toBe(true);
  });
});
