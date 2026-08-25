import { describe, expect, it } from "vitest";
import { COMMANDS, EXCLUDED_DOCS, ROLES, UPSTREAM_SHA, isCommand, isRole } from "../tools/port/inventory.mjs";
import { findBashSites, rewriteStructuredTools, rewriteUnconditionalTools } from "../tools/port/rules.mjs";

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
});

describe("R2 structured-position tool names", () => {
  it("rewrites a backticked single tool name for Read, Write, and Edit", () => {
    expect(rewriteStructuredTools("Call `Read` on the file.")).toBe("Call `read` on the file.");
    expect(rewriteStructuredTools("`Write` then `Edit`.")).toBe("`write` then `edit`.");
  });

  it("rewrites an explicit 'X tool' phrase, including Task", () => {
    expect(rewriteStructuredTools("Use the Read tool here.")).toBe("Use the read tool here.");
    expect(rewriteStructuredTools("Delegate via the Task tool.")).toBe("Delegate via the subagent tool.");
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
});
