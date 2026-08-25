import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { COMMANDS, EXCLUDED_DOCS, ROLES, UPSTREAM_SHA, isCommand, isRole } from "../tools/port/inventory.mjs";
import {
  appendRoutingLine,
  DEST,
  findBashSites,
  rewriteClaudeMd,
  rewriteCommands,
  rewriteDelegation,
  rewritePaths,
  rewriteStructuredTools,
  rewriteUnconditionalTools,
  transformRoleFrontmatter,
  transformSkillFrontmatter,
} from "../tools/port/rules.mjs";

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

  it("excludes exactly the ten Claude Code specific documents", () => {
    expect(EXCLUDED_DOCS).toHaveLength(10);
    expect(EXCLUDED_DOCS).toContain("hooks-reference.md");
    expect(EXCLUDED_DOCS).toContain("hooks-reference/pre-push-test-gate.md");
    expect(EXCLUDED_DOCS).toContain("settings-local-template.md");
    expect(EXCLUDED_DOCS).toContain("CLAUDE-local-template.md");
    expect(EXCLUDED_DOCS).toContain("setup-requirements.md");
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

describe("R1 unconditional tool names", () => {
  it("rewrites names that are never English words", () => {
    const out = rewriteUnconditionalTools(
      "Use Glob and Grep, then WebSearch. Also WebFetch, TodoWrite, AskUserQuestion.",
    );
    expect(out).toBe(
      "Use glob and grep, then web_search. Also web_fetch, todo_write, ask_user_question.",
    );
  });

  it("leaves the English words alone", () => {
    const prose = "Read the design doc, Write the summary, then Edit it.";
    expect(rewriteUnconditionalTools(prose)).toBe(prose);
  });

  it("does not corrupt real identifiers that merely contain an unconditional tool name as a substring", () => {
    // Real corpus tokens: Global x17, [GlobalClass] x3, DynamicGlobalIlluminationMethod x1 —
    // all contain "Glob" as a substring but are not the Glob tool. Without the trailing
    // word boundary on R1's regex, each would corrupt to e.g. "globalClass".
    const prose =
      "Godot's Global autoload and the [GlobalClass] attribute both relate to " +
      "DynamicGlobalIlluminationMethod, and GrepResults is an unrelated helper class.";
    expect(rewriteUnconditionalTools(prose)).toBe(prose);
  });
});

describe("R2 structured-position tool names", () => {
  it("rewrites a backticked single tool name for Read, Write, and Edit", () => {
    expect(rewriteStructuredTools("Call `Read` on the file.")).toBe("Call `read` on the file.");
    expect(rewriteStructuredTools("`Write` then `Edit`.")).toBe("`write` then `edit`.");
  });

  it("rewrites an explicit 'X tool' phrase for every structured name", () => {
    expect(rewriteStructuredTools("Use the Read tool here.")).toBe("Use the read tool here.");
    expect(rewriteStructuredTools("Use the Write tool here.")).toBe("Use the write tool here.");
    expect(rewriteStructuredTools("Use the Edit tool here.")).toBe("Use the edit tool here.");
    expect(rewriteStructuredTools("Delegate via the Task tool.")).toBe("Delegate via the subagent tool.");
  });

  it("does not match 'tool' as a prefix of a longer word after a structured name", () => {
    // Without the phrase regex's trailing boundary, "Edit tool" would match the
    // start of "Edit toolbar" and corrupt it to "edit toolbar".
    const prose = "Open the Edit toolbar and check the Write toolkit.";
    expect(rewriteStructuredTools(prose)).toBe(prose);
  });

  it("does NOT rewrite a bare-backticked `Task` — it collides with C#/C++/.NET's async Task type", () => {
    // Verbatim real-world site: agents/godot-csharp-specialist.md:205. `Task` here
    // is .NET's async return type, not the delegation tool — rewriting it would
    // produce "Return `subagent` for testable async methods...", which is nonsense.
    const s = "- Return `Task` for testable async methods that callers need to await";
    expect(rewriteStructuredTools(s)).toBe(s);
  });

  it("LEAVES PROSE UNTOUCHED — the whole point of this rule", () => {
    const prose = [
      "Read the existing ADR file completely.",
      "1. **Read silently** — complete the full audit before presenting anything",
      "Write a short summary, then Edit the draft.",
      "Reading and writing are both fine.",
      "The Task is to ship the vertical slice.",
    ].join("\n");
    expect(rewriteStructuredTools(prose)).toBe(prose);
  });

  it("does not touch a backticked phrase that merely contains a tool name", () => {
    const s = "See `Read the docs` for details.";
    expect(rewriteStructuredTools(s)).toBe(s);
  });
});

describe("R2 enumerated compound phrases", () => {
  it("rewrites the three enumerated multi-tool phrases", () => {
    // Real corpus site: agents/lead-programmer.md:50.
    expect(rewriteStructuredTools("Wait for 'yes' before using Write/Edit tools.")).toBe(
      "Wait for 'yes' before using write/edit tools.",
    );
    expect(rewriteStructuredTools("Confirm before using Write or Edit tools here.")).toBe(
      "Confirm before using write or edit tools here.",
    );
    // Real corpus site: agents/art-director.md:75.
    expect(
      rewriteStructuredTools("If running as a Task subagent, structure text so the orchestrator can present it."),
    ).toBe("If running as a subagent, structure text so the orchestrator can present it.");
  });

  it("leaves an unrelated lowercase phrase alone", () => {
    const prose = "The level edit tools panel is under the View menu.";
    expect(rewriteStructuredTools(prose)).toBe(prose);
  });
});

describe("R3 Bash sites are reported, never rewritten", () => {
  it("reports each site with its line number and leaves the text alone", () => {
    const text = "line one\nRun Bash to build.\nnothing here\nUse `Bash` carefully.\n";
    const sites = findBashSites(text);
    expect(sites).toEqual([
      { line: 2, text: "Run Bash to build." },
      { line: 4, text: "Use `Bash` carefully." },
    ]);
    expect(rewriteUnconditionalTools(text)).toBe(text);
    expect(rewriteStructuredTools(text)).toBe(text);
  });

  it("does not match Bash as a substring of a longer identifier", () => {
    const text = "Bashful greetings.\nSuperBash mode enabled.\nBash the code.\n";
    const sites = findBashSites(text);
    expect(sites).toEqual([{ line: 3, text: "Bash the code." }]);
  });

  it("skips Bash mentions inside tool-list frontmatter and Bash(...) permission specs", () => {
    const text = [
      "---",
      "tools: Read, Write, Edit, Bash, Grep",
      "allowed-tools: Bash(git commit:*), Read",
      "disallowedTools: Bash",
      "---",
      "Run Bash to build the project.",
    ].join("\n");
    const sites = findBashSites(text);
    expect(sites).toEqual([{ line: 6, text: "Run Bash to build the project." }]);
  });
});

describe("R4 command names are whitelist-driven", () => {
  it("prefixes a known command", () => {
    expect(rewriteCommands("Run /dev-story then /story-done.")).toBe(
      "Run /gs-dev-story then /gs-story-done.",
    );
  });

  it("leaves slash-shaped strings that are not commands", () => {
    const s = "Write to /tmp/out, check the 3/4 ratio, see https://x.dev/docs/start here.";
    expect(rewriteCommands(s)).toBe(s);
  });

  it("does not prefix a command name that merely starts like one", () => {
    expect(rewriteCommands("/starting is not a command")).toBe("/starting is not a command");
  });

  it("does not double-prefix an already-ported command", () => {
    expect(rewriteCommands("/gs-start")).toBe("/gs-start");
  });

  it("rewrites inside backticks and inside frontmatter values alike", () => {
    expect(rewriteCommands("See `/qa-plan` first.")).toBe("See `/gs-qa-plan` first.");
    expect(rewriteCommands("description: Runs after /smoke-check.")).toBe(
      "description: Runs after /gs-smoke-check.",
    );
  });

  it("does not corrupt a bracketed path segment whose basename collides with a command name", () => {
    // Real corpus site: agents/community-manager.md:82 and :144, skills/patch-notes/SKILL.md
    // (multiple lines). Before the `]` lookbehind fix, the `]` in `[version]` isn't a word
    // character, so the regex misread the path's final segment as a command start and produced
    // a filename that does not exist: `.../gs-patch-notes.md`.
    const s = "- Patch notes go in `production/releases/[version]/patch-notes.md`";
    expect(rewriteCommands(s)).toBe(s);
  });

  it("does not treat a command-shaped basename immediately followed by a file extension as a command", () => {
    // Real corpus site: skills/patch-notes/SKILL.md:22 — same defect class as the `]` case
    // above (a path basename colliding with a command name), caught by an orthogonal guard:
    // a genuine command reference is never immediately followed by `.<extension>`.
    const s = "Read the internal changelog at `production/releases/[version]/changelog.md` if it exists";
    expect(rewriteCommands(s)).toBe(s);
  });

  it("still rewrites a command followed by trailing punctuation with no extension", () => {
    // Guards against the extension check over-suppressing: a bare command at the end of a
    // sentence has a period but nothing alphanumeric immediately after it.
    expect(rewriteCommands("Run /changelog.")).toBe("Run /gs-changelog.");
  });
});

describe("R5 delegation", () => {
  it("turns a concrete subagent_type into the self-read delegation form", () => {
    expect(rewriteDelegation("- `subagent_type: lead-programmer` — Review the fix")).toBe(
      "- delegate to `lead-programmer` (the child reads `roles/lead-programmer.md` itself) — Review the fix",
    );
  });

  it("preserves a placeholder rather than treating it as a role name", () => {
    const s = "Spawn `subagent_type: [primary specialist]` with the ADR section";
    expect(rewriteDelegation(s)).toBe(
      "Spawn a subagent for `[primary specialist]` (the child reads its own brief under `roles/`) with the ADR section",
    );
  });

  it("leaves an unknown role untouched so the manifest can flag it", () => {
    const s = "`subagent_type: nonexistent-role`";
    expect(rewriteDelegation(s)).toBe(s);
  });
});

describe("R6/R8 paths dispatch on destination", () => {
  it("uses the substitution marker for orchestration files", () => {
    expect(rewritePaths("See .claude/agents/producer.md", DEST.ORCHESTRATION)).toBe(
      "See %%GS_CONTENT_DIR%%roles/producer.md",
    );
  });

  it("uses a two-level-up relative path for command skills (content/skills/gs-x/SKILL.md)", () => {
    expect(rewritePaths("See .claude/agents/producer.md", DEST.SKILL)).toBe(
      "See ../../roles/producer.md",
    );
  });

  it("uses a ONE-level-up relative path for handbook/template/rule/role/pipeline docs (content/<dir>/x.md) — not two", () => {
    // The defect this guards against: content/handbook/x.md sits one level under
    // content/, so `../../` overshoots to the directory ABOVE content/, where
    // nothing exists. Only `../` lands back inside content/.
    expect(rewritePaths("See .claude/agents/producer.md", DEST.DOC)).toBe(
      "See ../roles/producer.md",
    );
  });

  it("uses a two-level-up relative path for engine-reference docs, which nest one more level (content/engines/<engine>/x.md)", () => {
    expect(rewritePaths("See docs/engine-reference/godot/x.md", DEST.DOC_NESTED)).toBe(
      "See ../../engines/godot/x.md",
    );
  });

  it("NEVER emits a marker for any non-orchestration destination — the provider ships bodies verbatim", () => {
    const src = ".claude/rules/ai-code.md and .claude/docs/templates/art-bible.md";
    for (const dest of [DEST.SKILL, DEST.DOC, DEST.DOC_NESTED]) {
      const out = rewritePaths(src, dest);
      expect(out).not.toContain("%%GS_");
    }
    expect(rewritePaths(src, DEST.SKILL)).toBe("../../rules/ai-code.md and ../../templates/art-bible.md");
    expect(rewritePaths(src, DEST.DOC)).toBe("../rules/ai-code.md and ../templates/art-bible.md");
  });

  it("maps every upstream directory to its content/ destination, at DOC's one-level depth", () => {
    const cases: [string, string][] = [
      [".claude/agents/x.md", "roles/x.md"],
      [".claude/rules/x.md", "rules/x.md"],
      [".claude/docs/templates/x.md", "templates/x.md"],
      [".claude/docs/x.md", "handbook/x.md"],
      [".claude/skills/x/SKILL.md", "skills/gs-x/SKILL.md"],
    ];
    for (const [from, to] of cases) {
      expect(rewritePaths(from, DEST.DOC)).toBe(`../${to}`);
    }
  });

  it("resolves the emitted relative path back inside content/ for every non-marker destination and real output location", () => {
    // A fixture string comparison cannot catch a depth error — the whole
    // defect this test exists for is a relative path that string-compares
    // "correctly" against a hand-written expectation but resolves nowhere.
    // Resolving it against a representative real Task-12 output location is
    // what makes the check meaningful.
    const cases: [string, string][] = [
      ["content/skills/gs-help/SKILL.md", DEST.SKILL],
      ["content/handbook/agent-roster.md", DEST.DOC],
      ["content/templates/art-bible.md", DEST.DOC],
      ["content/rules/ai-code.md", DEST.DOC],
      ["content/roles/producer.md", DEST.DOC],
      ["content/pipeline/vertical-slice.md", DEST.DOC],
      ["content/engines/godot/gdscript-basics.md", DEST.DOC_NESTED],
    ];
    for (const [outputPath, dest] of cases) {
      const rewritten = rewritePaths(".claude/agents/producer.md", dest);
      const resolved = posix.resolve("/", posix.dirname(outputPath), rewritten);
      expect(resolved).toBe("/content/roles/producer.md");
      expect(resolved.startsWith("/content/")).toBe(true);
    }
  });
});

describe("R7 CLAUDE.md becomes AGENTS.md", () => {
  it("rewrites the filename wherever it appears", () => {
    expect(rewriteClaudeMd("Update CLAUDE.md and src/CLAUDE.md")).toBe(
      "Update AGENTS.md and src/AGENTS.md",
    );
  });
});

const SKILL_FM = [
  "name: dev-story",
  "description: Implement one story end to end. Run after /create-stories.",
  "argument-hint: <story-id>",
  "user-invocable: true",
  "allowed-tools: Read, Glob, Grep, Write, Edit, Bash",
  "model: sonnet",
  "agent: lead-programmer",
  "",
].join("\n");

describe("R10/R12 skill frontmatter", () => {
  it("renames, adds the model-invocation switch, and folds the rest into metadata", () => {
    const { frontmatter, routedRole } = transformSkillFrontmatter(SKILL_FM, "gs-dev-story");
    expect(frontmatter).toContain("name: gs-dev-story");
    expect(frontmatter).toContain("disable-model-invocation: true");
    expect(frontmatter).toContain("user-invocable: true");
    expect(frontmatter).toContain("metadata:");
    expect(frontmatter).toContain("  argument-hint: <story-id>");
    expect(frontmatter).toContain("  agent: lead-programmer");
    expect(frontmatter).toContain("  model: sonnet");
    expect(frontmatter).not.toContain("allowed-tools:");
    expect(routedRole).toBe("lead-programmer");
  });

  it("runs the command whitelist over the description too", () => {
    const { frontmatter } = transformSkillFrontmatter(SKILL_FM, "gs-dev-story");
    expect(frontmatter).toContain("Run after /gs-create-stories.");
  });

  it("never emits a rejected legacy invocation spelling", () => {
    const { frontmatter } = transformSkillFrontmatter(SKILL_FM, "gs-dev-story");
    for (const bad of ["disableModelInvocation", "modelInvocable", "userInvocable"]) {
      expect(frontmatter).not.toContain(bad);
    }
  });

  it("reports no routed role when upstream had none", () => {
    const fm = "name: help\ndescription: Show help.\nuser-invocable: true\nmodel: haiku\n";
    expect(transformSkillFrontmatter(fm, "gs-help").routedRole).toBeUndefined();
  });

  it("preserves an upstream user-invocable: false instead of silently overwriting it", () => {
    // user-invocable is a SKILL_TOP_LEVEL key, so it is also excluded from
    // the metadata fold below — a hardcoded `true` here would erase a
    // hypothetical upstream `false` with no trace of it anywhere in the
    // output. Not reachable in the current corpus (73/73 upstream skills
    // set it to true explicitly), but the read-and-preserve behavior must
    // hold regardless of what today's corpus happens to contain.
    const fm = "name: x\ndescription: d\nuser-invocable: false\nallowed-tools: Read\nmodel: sonnet\n";
    const { frontmatter } = transformSkillFrontmatter(fm, "gs-x");
    expect(frontmatter).toContain("user-invocable: false");
    expect(parseYaml(frontmatter)["user-invocable"]).toBe(false);
  });
});

const ROLE_FM = [
  "name: gameplay-programmer",
  "description: Implements gameplay systems.",
  "tools: Read, Glob, Grep, Write, Edit, Bash",
  "model: sonnet",
  "maxTurns: 30",
  "memory: user",
  "disallowedTools: WebSearch",
  "",
].join("\n");

describe("R11 role frontmatter", () => {
  it("emits the harness-shaped keys and moves the rest into an advisory block", () => {
    const { frontmatter, advisory } = transformRoleFrontmatter(ROLE_FM, "gameplay-programmer");
    expect(frontmatter).toContain("role: gameplay-programmer");
    expect(frontmatter).toContain("tier: 3");
    expect(frontmatter).toContain("department: engineering");
    expect(frontmatter).toContain("model-tier: sonnet");
    expect(frontmatter).not.toContain("maxTurns");
    expect(frontmatter).not.toContain("disallowedTools");
    expect(advisory).toContain("Suggested tools");
    expect(advisory).toContain("maxTurns");
    // Locks in the property that makes bypassing R1/R2 for this quoted list
    // safe: the tool names must survive byte-for-byte, including the bare
    // English-word names (Glob, Grep) that rewriteUnconditionalTools would
    // otherwise lowercase via an unqualified \bGlob\b / \bGrep\b match if the
    // advisory were ever spliced into the body BEFORE R1 runs over the rest
    // of it (see transformRoleFrontmatter's CALLER CONTRACT doc comment).
    expect(advisory).toContain("Read, Glob, Grep, Write, Edit, Bash");
  });

  it("assigns tier 1 to a director", () => {
    const fm = "name: producer\ndescription: d\ntools: Read\nmodel: opus\nmaxTurns: 30\n";
    expect(transformRoleFrontmatter(fm, "producer").frontmatter).toContain("tier: 1");
  });
});

describe("R13 routing line", () => {
  it("appends a model-visible line naming the usual role", () => {
    expect(appendRoutingLine("# Body\n\nText.\n", "lead-programmer")).toBe(
      "# Body\n\nText.\n\n---\n\nUsually executed by the `lead-programmer` role. Load `gs-roster` for the delegation protocol.\n",
    );
  });
});

describe("R10/R11 frontmatter values with embedded colons stay parseable YAML", () => {
  it("quotes a skill description containing a colon so re-parsing recovers it exactly", () => {
    // Real corpus shape: 15/73 skill descriptions and 25/49 agent descriptions
    // contain a mid-string ": " — upstream double-quotes every description for
    // exactly this reason. A naive `description: ${value}` interpolation would
    // silently corrupt these into a nested mapping.
    const fm = [
      "name: consistency-check",
      // Real upstream files double-quote every description; this fixture
      // does the same so the INPUT itself is valid YAML — the point under
      // test is the OUTPUT re-serialization, not upstream's own quoting.
      'description: "Detect inconsistencies: same entity, different stats."',
      "user-invocable: true",
      "allowed-tools: Read",
      "model: sonnet",
      "",
    ].join("\n");
    const { frontmatter } = transformSkillFrontmatter(fm, "gs-consistency-check");
    const parsed = parseYaml(frontmatter);
    expect(parsed.description).toBe("Detect inconsistencies: same entity, different stats.");
  });

  it("quotes a role description containing a colon so re-parsing recovers it exactly", () => {
    const fm = [
      "name: qa-lead",
      'description: "Owns QA: test plans, triage, and release sign-off."',
      "tools: Read",
      "model: sonnet",
      "",
    ].join("\n");
    const { frontmatter } = transformRoleFrontmatter(fm, "qa-lead");
    const parsed = parseYaml(frontmatter);
    expect(parsed.description).toBe("Owns QA: test plans, triage, and release sign-off.");
  });

  it("preserves a multi-line metadata value (upstream's shell-command context block) without corrupting the YAML", () => {
    // Real corpus shape: three skills (changelog, help, sprint-plan) carry a
    // `context: |` block scalar of shell commands. Naive string interpolation
    // would splice the embedded newline into the metadata block unindented,
    // breaking the YAML for every file after it.
    const fm = [
      "name: sprint-status",
      "description: Reports sprint status.",
      "user-invocable: true",
      "allowed-tools: Read",
      "context: |",
      "  !ls production/sprints/ 2>/dev/null",
      "",
    ].join("\n");
    const { frontmatter } = transformSkillFrontmatter(fm, "gs-sprint-status");
    const parsed = parseYaml(frontmatter);
    expect(parsed.metadata.context).toContain("!ls production/sprints/");
  });

  it("never lets the routed-role lookup or the role lookup be fooled by Object.prototype membership", () => {
    // ROLES is a plain object; `"constructor" in ROLES` is true via the
    // prototype chain even though it is not a real role. The routedRole
    // check and transformRoleFrontmatter's own guard must use isRole()
    // (Set-backed, exact membership), not a bare `ROLES[key]` truthiness
    // check, so a stray `agent: constructor` can't be misread as valid.
    const fm = "name: x\ndescription: d\nuser-invocable: true\nallowed-tools: Read\nagent: constructor\n";
    expect(transformSkillFrontmatter(fm, "gs-x").routedRole).toBeUndefined();
    expect(() =>
      transformRoleFrontmatter("name: constructor\ndescription: d\ntools: Read\nmodel: sonnet\n", "constructor"),
    ).toThrow();
  });
});
