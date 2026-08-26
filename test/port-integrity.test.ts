import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentDir } from "../src/content.js";
import { rewritePaths } from "../tools/port/rules.mjs";
import {
  checkCounts, checkMarkerLeaks, checkReferentialIntegrity, checkSnapshotLineEndings,
  EXPECTED_COUNTS, renderManifest,
} from "../tools/port/manifest.mjs";

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

  // Spec §5's third G3 clause: every relative resource path resolves. Round
  // one only implemented the first two (command exists, role exists) and
  // never resolved a relative path at all — the review-round scan that
  // added this clause found 3 unresolved out of 127 real corpus refs.
  describe("clause 3: relative resource paths", () => {
    it("passes when a markdown-link relative path resolves from the referencing file's own directory", () => {
      const problems = checkReferentialIntegrity([
        { path: "engines/unity/PLUGINS.md", text: "See [modules/input.md](modules/input.md)" },
        { path: "engines/unity/modules/input.md", text: "Input System reference." },
      ]);
      expect(problems).toEqual([]);
    });

    it("passes when a backtick-quoted relative path resolves", () => {
      const problems = checkReferentialIntegrity([
        { path: "skills/gs-onboard/SKILL.md", text: "Check `../../handbook/technical-preferences.md`." },
        { path: "handbook/technical-preferences.md", text: "Preferences." },
      ]);
      expect(problems).toEqual([]);
    });

    it("flags a relative reference that does not resolve, resolved from the FILE's directory not content/'s root", () => {
      // The exact upstream-typo shape this clause was written to catch:
      // PLUGINS.md sits at engines/unity/, so "../modules/input.md" walks
      // out of unity/ to engines/modules/input.md — one level too far, since
      // modules/ is a sibling of PLUGINS.md, not of unity/.
      const problems = checkReferentialIntegrity([
        { path: "engines/unity/PLUGINS.md", text: "See [modules/input.md](../modules/input.md)" },
      ]);
      expect(problems.join(" ")).toContain("../modules/input.md");
      expect(problems.join(" ")).toContain("engines/modules/input.md");
    });

    it("does not flag the allowlisted gs-patch-notes glob-probe reference", () => {
      // templates/patch-notes-template.md never existed upstream; the skill
      // reaches it via a glob-and-degrade-gracefully pattern, so a miss is
      // fine. Allowlisted explicitly rather than silently.
      const problems = checkReferentialIntegrity([
        {
          path: "skills/gs-patch-notes/SKILL.md",
          text: "glob for `../../templates/patch-notes-template.md`",
        },
      ]);
      expect(problems).toEqual([]);
    });

    it("does not allowlist the same missing target from a different referencing file", () => {
      // The allowlist key is (referencing path -> resolved path), not just
      // the resolved path — the same broken target named from anywhere else
      // must still fail.
      const problems = checkReferentialIntegrity([
        { path: "skills/gs-other/SKILL.md", text: "`../../templates/patch-notes-template.md`" },
      ]);
      expect(problems.join(" ")).toContain("templates/patch-notes-template.md");
    });

    it("ignores a same-directory reference with no leading ../ (out of scope, not a false negative)", () => {
      // A bare "modules/input.md" is indistinguishable from unrelated
      // path-shaped prose without a lot more context; this clause only
      // resolves the unambiguous `../`-prefixed shape the real corpus uses.
      const problems = checkReferentialIntegrity([
        { path: "engines/unity/PLUGINS.md", text: "See `modules/does-not-exist.md`" },
      ]);
      expect(problems).toEqual([]);
    });
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
      engines: 46, handbook: 13, pipeline: 2, excluded: 10,
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

describe("templates index", () => {
  it("is generated with one row per template", () => {
    const index = readFileSync(`${contentDir()}templates/_index.md`, "utf8");
    const rows = index.split("\n").filter((l) => l.startsWith("- `"));
    expect(rows.length).toBe(40);
    expect(index).not.toContain("_index");
  });

  it("preserves nested subpaths so the printed paths resolve", () => {
    // walkMd(templatesSrcDir) yields `rel` values that include subpaths
    // (collaborative-protocols/...) — the index must print those subpaths
    // verbatim, not just the bare filename, or a reader following a row
    // gets a path that does not exist.
    const index = readFileSync(`${contentDir()}templates/_index.md`, "utf8");
    expect(index).toContain("`collaborative-protocols/design-agent-protocol.md`");
  });
});

describe("checkSnapshotLineEndings", () => {
  // fixupClaudeDocResidue's FROM/TO blocks are exact-literal `\n`-joined
  // string matches (port.mjs). A snapshot checked out on Windows with the
  // common core.autocrlf=true default (no upstream .gitattributes to
  // override it) silently rewrites every "\n" to "\r\n", which makes every
  // FROM block miss by one byte — no error, just raw upstream prose
  // surviving into a ported file. See task-17-report.md's "CRLF" finding
  // for the byte-level repro this check exists to catch before it happens
  // again, loudly, instead of shipping wrong output silently.
  it("passes on LF-only sampled files", () => {
    expect(checkSnapshotLineEndings([
      { path: ".claude/docs/quick-start.md", text: "# Quick Start\n\nSome text.\n" },
    ])).toEqual([]);
  });

  it("flags a CRLF-containing sampled file and names the fix", () => {
    const problems = checkSnapshotLineEndings([
      { path: ".claude/docs/quick-start.md", text: "# Quick Start\r\n\r\nSome text.\r\n" },
    ]);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain(".claude/docs/quick-start.md");
    expect(problems[0]).toContain("core.autocrlf=false");
  });

  it("flags every CRLF-containing file among several sampled, not just the first", () => {
    const problems = checkSnapshotLineEndings([
      { path: "a.md", text: "clean\n" },
      { path: "b.md", text: "dirty\r\n" },
      { path: "c.md", text: "also dirty\r\n" },
    ]);
    expect(problems.length).toBe(2);
    expect(problems.join(" ")).toContain("b.md");
    expect(problems.join(" ")).toContain("c.md");
    expect(problems.join(" ")).not.toContain("a.md: ");
  });
});
