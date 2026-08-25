import { describe, expect, it } from "vitest";
import { rewritePaths } from "../tools/port/rules.mjs";
import { checkCounts, checkMarkerLeaks, checkReferentialIntegrity, EXPECTED_COUNTS, renderManifest } from "../tools/port/manifest.mjs";

describe("G3 referential integrity", () => {
  it("passes when every reference resolves", () => {
    expect(checkReferentialIntegrity([
      { path: "skills/gs-start/SKILL.md", text: "See /gs-dev-story and roles/producer.md" },
    ])).toEqual([]);
  });

  it("flags a slash command that is not one of the 73", () => {
    const problems = checkReferentialIntegrity([
      { path: "skills/gs-start/SKILL.md", text: "Run /gs-not-a-command now" },
    ]);
    expect(problems.join(" ")).toContain("gs-not-a-command");
  });

  it("flags a role reference that has no brief", () => {
    const problems = checkReferentialIntegrity([
      { path: "handbook/x.md", text: "roles/nonexistent-role.md" },
    ]);
    expect(problems.join(" ")).toContain("nonexistent-role");
  });

  it("does not treat an Object.prototype member as a valid role", () => {
    // The naive check `ROLES[name] === void 0` is truthy-via-prototype-chain
    // for "constructor" even though it is never a real role — the exact
    // pitfall rules.mjs documents for transformSkillFrontmatter's routedRole
    // check. checkReferentialIntegrity must use isRole(), not a bare lookup.
    const problems = checkReferentialIntegrity([
      { path: "handbook/x.md", text: "roles/constructor.md" },
    ]);
    expect(problems.join(" ")).toContain("constructor");
  });

  it("flags a leftover upstream path", () => {
    const problems = checkReferentialIntegrity([
      { path: "handbook/x.md", text: "see .claude/docs/quick-start.md" },
    ]);
    expect(problems.join(" ")).toContain(".claude/");
  });

  it("flags a leftover CLAUDE.md reference", () => {
    const problems = checkReferentialIntegrity([
      { path: "handbook/x.md", text: "see CLAUDE.md for the workspace rules" },
    ]);
    expect(problems.join(" ")).toContain("CLAUDE.md");
  });
});

describe("G4 counts", () => {
  // EXPECTED_COUNTS.skills is 74, not 73: the port writes 73 ported skills,
  // but Phase 1's first-party `gs-ping` probe already lives in
  // content/skills/ and is not one of the 73. A correct port leaves 74
  // directories on disk, so checkCounts must expect the aggregate.
  it("carries the pinned-snapshot counts, aggregating first-party skills into the 73 ported", () => {
    expect(EXPECTED_COUNTS).toEqual({
      skills: 74, roles: 49, templates: 40, rules: 11,
      engines: 46, handbook: 13, pipeline: 2, excluded: 9,
    });
  });

  it("passes on the exact expected inventory", () => {
    expect(checkCounts(EXPECTED_COUNTS)).toEqual([]);
  });

  it("fails loudly on a short port", () => {
    expect(checkCounts({ ...EXPECTED_COUNTS, skills: EXPECTED_COUNTS.skills - 1 }).join(" ")).toContain("skills");
  });

  it("fails loudly on any other mismatched group", () => {
    expect(checkCounts({ ...EXPECTED_COUNTS, roles: 48 }).join(" ")).toContain("roles");
  });
});

describe("renderManifest reports the skills split behind the aggregate", () => {
  // The aggregate alone (74) can hide a short port offset by an unrelated
  // extra, so the manifest must print ported and first-party separately —
  // that split is what keeps a short port visible.
  it("prints ported and first-party counts, not just the aggregate", () => {
    const md = renderManifest({
      sha: "984023d",
      counts: { ...EXPECTED_COUNTS },
      skillsPorted: 73,
      skillsFirstParty: 1,
      ruleHits: { R1: 12, R4: 340 },
      excluded: ["hooks-reference.md"],
      bashSites: [{ file: "rules/ai-code.md", line: 3, text: "Run Bash to build." }],
    });
    expect(md).toContain("73 ported");
    expect(md).toContain("1 first-party");
  });
});

describe("G1 no substitution marker under content/skills/**", () => {
  it("passes when no skill file carries a marker", () => {
    expect(checkMarkerLeaks([
      { path: "skills/gs-ping/SKILL.md", text: "Read `references/probe.md` beside this skill." },
    ])).toEqual([]);
  });

  it("flags a %%GS_ marker reaching a command skill", () => {
    // The exact scenario a reviewer planted to prove sequential gate exit
    // was hiding this gate: a genuine %%GS_CONTENT_DIR%%roles/producer.md
    // line appended into content/skills/gs-ping/SKILL.md, which clearOwned()
    // never touches and which G3's checks (command/role/.claude//CLAUDE.md)
    // do not look for. Only a marker-specific check catches it.
    const problems = checkMarkerLeaks([
      { path: "skills/gs-ping/SKILL.md", text: "See %%GS_CONTENT_DIR%%roles/producer.md for the roster." },
    ]);
    expect(problems.join(" ")).toContain("skills/gs-ping/SKILL.md");
    expect(problems.join(" ")).toContain("%%GS_");
  });
});

describe("rewritePaths guards against an unrecognized destination", () => {
  it("throws rather than silently defaulting to a two-level-up path", () => {
    // The silent fallback this guards against is exactly the Task 10 defect:
    // an unrecognized dest used to fall through to "../../", which is the
    // WRONG depth for a DOC-class file and nothing would catch it.
    expect(() => rewritePaths("x", "not-a-real-dest")).toThrow();
  });
});
