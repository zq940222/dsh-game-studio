import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isSkillName } from "@deepseek-ai/dsh-skill";
import { checkNoMarkers, checkNoMarkersTree, checkSkillDir, checkSkillRoot, contentDir } from "../src/content.js";

const fixtures = fileURLToPath(new URL("./fixtures/skills/", import.meta.url));
const markerFixtures = fileURLToPath(new URL("./fixtures/marker-skills/", import.meta.url));
const crlfFixtures = fileURLToPath(new URL("./fixtures/crlf-skills/", import.meta.url));
const markerRoleFixtures = fileURLToPath(new URL("./fixtures/marker-roles/", import.meta.url));
const crlfRoleFixtures = fileURLToPath(new URL("./fixtures/crlf-roles/", import.meta.url));
const treeGoodFixtures = fileURLToPath(new URL("./fixtures/tree-good/", import.meta.url));
const treeMarkerFixtures = fileURLToPath(new URL("./fixtures/tree-marker/", import.meta.url));
const treeCrlfFixtures = fileURLToPath(new URL("./fixtures/tree-crlf/", import.meta.url));
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

describe("G1 command skills must never carry a substitution marker", () => {
  // Renamed from "flags a marker in a shipped command skill" — that name
  // asserted the opposite of what the test checks: this fixture root has
  // no marker or CRLF in it, so checkNoMarkers must stay quiet over it.
  it("raises nothing over skill fixtures with no marker or CRLF", () => {
    const problems = checkNoMarkers(`${fixtures}`);
    expect(problems).toEqual([]);
  });

  it("flags a marker when one is present", () => {
    const problems = checkNoMarkers(markerFixtures);
    expect(problems.map((p) => p.kind)).toContain("marker-leak");
  });

  it("flags CRLF in a shipped command skill", () => {
    const problems = checkNoMarkers(crlfFixtures);
    expect(problems.map((p) => p.kind)).toContain("crlf");
  });

  // The check must catch a bare \r, not just the \r\n pair: a lone \r
  // injects the identical control byte into model-facing text and is the
  // same class of defect, just rarer on a Windows/autocrlf checkout.
  it("flags a bare CR with no paired LF, not only a full CRLF pair", () => {
    const problems = checkNoMarkers(crlfFixtures);
    const bareCr = problems.filter((p) => p.dir === "gs-bare-cr");
    expect(bareCr.map((p) => p.kind)).toContain("crlf");
  });

  // The harness treats a skill's references/, scripts/, and assets/
  // subdirectories as resource roots the model is told to read at an
  // absolute path (Phase 1's own install probe proved that path works,
  // reading references/probe.md from a different drive) — so a resource
  // file is exactly as model-facing as SKILL.md itself, and checking only
  // SKILL.md would miss a marker or CRLF that ships right beside it.
  it("flags a marker in a skill's reference file, not only SKILL.md, and still reports the skill directory", () => {
    const problems = checkNoMarkers(markerFixtures);
    const refLeak = problems.find((p) => p.dir === "gs-ref-leak" && p.kind === "marker-leak");
    expect(refLeak).toBeDefined();
    expect(refLeak?.detail).toContain("references/leaky.md");
  });

  it("flags CRLF in a skill's reference file, not only SKILL.md, and still reports the skill directory", () => {
    const problems = checkNoMarkers(crlfFixtures);
    const refCrlf = problems.find((p) => p.dir === "gs-ref-crlf" && p.kind === "crlf");
    expect(refCrlf).toBeDefined();
    expect(refCrlf?.detail).toContain("references/leaky.md");
  });

  it("raises nothing for the real content/skills/ tree, including gs-ping's references/probe.md", () => {
    const problems = checkNoMarkers(`${contentDir()}skills/`);
    expect(problems).toEqual([]);
  });
});

describe("G1/G2 also cover flat role-brief roots (no SKILL.md nesting)", () => {
  // content/roles/ holds loose <role>.md files, not <name>/SKILL.md
  // directories — checkNoMarkers can't walk that shape (it statSync-skips
  // non-directories), so this is the sibling checkNoMarkersTree's job.
  // Role briefs reach a delegated subagent with NO normalizing loader in
  // front of them at all — not even the CRLF-stripping the orchestration
  // loader does — so this gate is the only thing standing between a bad
  // checkout and a child model's context.
  it("flags a marker in a loose role brief", () => {
    const problems = checkNoMarkersTree(markerRoleFixtures);
    expect(problems.map((p) => p.kind)).toContain("marker-leak");
  });

  it("flags CRLF in a loose role brief", () => {
    const problems = checkNoMarkersTree(crlfRoleFixtures);
    expect(problems.map((p) => p.kind)).toContain("crlf");
  });

  it("raises nothing for the real content/roles/ tree", () => {
    const problems = checkNoMarkersTree(`${contentDir()}roles/`);
    expect(problems).toEqual([]);
  });
});

describe("G1/G2 cover every content/ directory except orchestration/, at any nesting depth", () => {
  // content/engines/<engine>/** nests one level deeper than content/roles/
  // — checkNoMarkersTree must recurse, not assume a fixed depth. These
  // fixtures mirror that shape: an engine-like top directory containing
  // both a top-level doc and a doc nested two levels deep (engine/sub/doc).
  it("raises nothing over a clean nested tree, at any depth", () => {
    const problems = checkNoMarkersTree(treeGoodFixtures);
    expect(problems).toEqual([]);
  });

  it("flags a marker leak nested two levels deep, with the nested relative path", () => {
    const problems = checkNoMarkersTree(treeMarkerFixtures);
    const leak = problems.find((p) => p.kind === "marker-leak");
    expect(leak?.dir).toBe("engine-a/sub/leaky.md");
  });

  it("flags CRLF nested two levels deep, with the nested relative path", () => {
    const problems = checkNoMarkersTree(treeCrlfFixtures);
    const crlf = problems.find((p) => p.kind === "crlf");
    expect(crlf?.dir).toBe("engine-a/sub/leaky.md");
  });

  // orchestration/ is the one directory that must NOT be scanned this way:
  // it legitimately contains %%GS_ markers by design (substituted at load
  // time by orchestration.ts, which does its own CRLF-normalize and
  // fail-loud marker scan). Scanning it with checkNoMarkersTree would flag
  // correct, as-shipped content — so this test asserts the opposite of
  // every other test in this file: that the real orchestration/ tree DOES
  // contain a marker, proving a lint that swept it in by mistake would
  // fail the build on legitimate content, not just stay silent.
  it("would wrongly flag the real orchestration/ tree if it were ever scanned this way", () => {
    const problems = checkNoMarkersTree(`${contentDir()}orchestration/`);
    expect(problems.map((p) => p.kind)).toContain("marker-leak");
  });
});

describe("no leftover `NOTICE` residue under content/", () => {
  // fixupClaudeDocResidue (tools/port/port.mjs) rewrites every "see NOTICE"
  // hook-degradation mention into a resolvable relative link to
  // handbook/guards.md via literal FROM/TO string blocks. Those blocks
  // silently no-op the moment the upstream source text they match drifts
  // even one byte (already happened twice in this phase — see the CRLF
  // snapshot finding in this task's report) — nothing else in the pipeline
  // would catch a stale matcher, because a bare `NOTICE` token was never a
  // resolvable link in the first place and so was never in G3's referential-
  // integrity scan. This test reads the real shipped content/ tree at test
  // time, independent of port.mjs's own matchers, so a stale literal fails
  // loudly here instead of shipping a dead pointer.
  it("finds zero `NOTICE` occurrences anywhere under the real content/ tree", () => {
    const root = contentDir();
    const offenders: string[] = [];
    const walk = (relDir: string): void => {
      for (const entry of readdirSync(`${root}${relDir}`)) {
        const relPath = `${relDir}${entry}`;
        if (statSync(`${root}${relPath}`).isDirectory()) {
          walk(`${relPath}/`);
          continue;
        }
        if (!entry.endsWith(".md")) continue;
        const text = readFileSync(`${root}${relPath}`, "utf8");
        if (text.includes("`NOTICE`")) offenders.push(relPath);
      }
    };
    walk("");
    expect(offenders).toEqual([]);
  });
});
