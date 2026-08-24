import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isSkillName } from "@deepseek-ai/dsh-skill";
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

  // The provider rejects THREE legacy invocation keys, not two:
  // dsh-skill-filesystem/lib/index.js:842-844 calls
  // rejectLegacyInvocationKey for disableModelInvocation, modelInvocable,
  // AND userInvocable. modelInvocable is also the exact key name used
  // inside OrchestrationSkill.invocation, so it is the one a port-script
  // author is most likely to reach for by analogy.
  it("catches the rejected camel-case 'modelInvocable' spelling", () => {
    const problems = checkSkillDir("gs-modelinvocable", read("gs-modelinvocable"));
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

  // splitFrontmatter must require an EXACT "---" fence line, matching the
  // provider's own parseFrontmatter/findClosingFrontmatter
  // (dsh-skill-filesystem/lib/index.js:771-793), not merely a line that
  // starts with "---". A "----" fence is the same silent-loss class as a
  // missing fence: the provider drops the whole skill.
  it("rejects a '----' opening fence that only starts with ---", () => {
    const problems = checkSkillDir(
      "gs-x",
      "----\nname: gs-x\ndescription: d\n---\n\nBody.\n",
    );
    expect(problems.map((p) => p.kind)).toContain("unparsable");
  });

  it("rejects a '----' closing fence that only starts with ---", () => {
    const problems = checkSkillDir(
      "gs-x",
      "---\nname: gs-x\ndescription: d\n----\n\nBody.\n",
    );
    expect(problems.map((p) => p.kind)).toContain("unparsable");
  });

  it("still accepts frontmatter fences on a CRLF checkout", () => {
    const source = "---\r\nname: gs-x\r\ndescription: d\r\n---\r\n\r\nBody.\r\n";
    expect(checkSkillDir("gs-x", source)).toEqual([]);
  });
});

describe("checkSkillRoot", () => {
  it("reports every bad fixture and nothing for the good one", () => {
    const problems = checkSkillRoot(fixtures);
    // Deduplicated: gs-CamelCase and gs-badbool each produce TWO problems,
    // so compare the set of offending directories, not the problem count.
    expect([...new Set(problems.map((p) => p.dir))].sort()).toEqual(
      ["gs-CamelCase", "gs-badbool", "gs-mismatch", "gs-modelinvocable", "gs-stray.md"].sort(),
    );
    expect(problems.some((p) => p.dir === "gs-good")).toBe(false);
  });

  // A stray content/skills/gs-foo.md from a future port tool would go
  // unlinted and vanish silently (the provider DOES discover
  // <root>/<name>.md as a skill: dsh-skill-filesystem/lib/index.js:583-590)
  // if checkSkillRoot kept silently `continue`-ing past non-directory
  // entries. It must be surfaced instead.
  it("reports a loose .md file at the skill root instead of skipping it", () => {
    const problems = checkSkillRoot(fixtures);
    const stray = problems.filter((p) => p.dir === "gs-stray.md");
    expect(stray).toHaveLength(1);
    expect(stray[0]!.kind).toBe("loose-file");
  });
});

describe("KEBAB / isSkillName parity", () => {
  // src/content.ts hand-copies the provider's kebab-case rule (KEBAB) as a
  // regex literal rather than importing @deepseek-ai/dsh-skill (src/ has a
  // no-@deepseek-ai-imports constraint). Nothing then ties the copy to the
  // original, so the two can silently drift. This test does — it is
  // allowed to import the provider's isSkillName because that constraint
  // binds src/, not test/, and the package is already a devDependency.
  //
  // checkSkillDir doesn't export KEBAB itself, so parity is asserted
  // through behavior: build a minimal well-formed skill body for each
  // candidate name and check whether checkSkillDir raises "not-kebab" for
  // it, exactly when the provider's own isSkillName rejects that name.
  const wellFormed = (candidateName: string) =>
    `---\nname: ${candidateName}\ndescription: d\ndisable-model-invocation: true\nuser-invocable: true\n---\n\nBody.\n`;

  it.each([
    "gs-good",
    "gs-good-name",
    "a",
    "a1",
    "GS-Bad",
    "-leading",
    "trailing-",
    "double--hyphen",
    "gs_underscore",
    "",
  ])("agrees with the provider's isSkillName for %j", (candidateName) => {
    const rejectedAsNotKebab = checkSkillDir(candidateName, wellFormed(candidateName)).some(
      (p) => p.kind === "not-kebab",
    );
    expect(rejectedAsNotKebab).toBe(!isSkillName(candidateName));
  });
});

describe("contentDir", () => {
  it("points at this package's own content directory", () => {
    expect(contentDir().endsWith("/")).toBe(true);
    expect(existsSync(contentDir())).toBe(true);
  });
});
