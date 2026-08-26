import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as SkillFilesystem from "@deepseek-ai/dsh-skill-filesystem";
import { apply, Config, inject, name } from "../src/index.js";
import { checkSkillRoot, contentDir } from "../src/content.js";
import type { OrchestrationSkill } from "../src/orchestration.js";

describe("plugin identity", () => {
  it("declares the cordis identity the patch row expects", () => {
    expect(name).toBe("game-studio");
    expect(inject).toEqual(["skills"]);
  });

  it("applies documented defaults to an empty config", () => {
    const resolved = new Config({});
    expect(resolved.engine).toBe("auto");
    expect(resolved.reviewIntensity).toBe("full");
    expect(resolved.watch).toBe(false);
    expect(resolved.exposeCommandSkillsToModel).toBe(false);
  });

  it("rejects an unknown engine", () => {
    expect(() => new Config({ engine: "cryengine" })).toThrow();
  });
});

describe("shipped command skills", () => {
  it("ships gs-ping and it satisfies every provider invariant", () => {
    const problems = checkSkillRoot(`${contentDir()}skills/`);
    expect(problems).toEqual([]);
    const source = readFileSync(`${contentDir()}skills/gs-ping/SKILL.md`, "utf8");
    expect(source).toContain("name: gs-ping");
    expect(source).toContain("disable-model-invocation: true");
    expect(source).toContain("user-invocable: true");
  });

  it("mounts the skill provider with an isolated custom root", () => {
    const mounted: { plugin: unknown; config: Record<string, unknown> }[] = [];
    const ctx = {
      plugin: (plugin: unknown, config: Record<string, unknown>) => {
        mounted.push({ plugin, config });
      },
      skills: { register: () => () => {} },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];

    apply(ctx, new Config({}));

    const provider = mounted.find((m) => m.config["providerName"] === "game-studio");
    expect(provider).toBeDefined();
    // Identity, not just the config shape: the mounted plugin must be the
    // skill-filesystem module itself, not some other plugin that happens
    // to accept a `providerName` option.
    expect(provider!.plugin).toBe(SkillFilesystem);
    expect(provider!.config["includeDefaultRoots"]).toBe(false);
    expect(provider!.config["watch"]).toBe(false);
    expect(provider!.config["customSkillDirs"]).toEqual([`${contentDir()}skills/`]);
  });

  it("propagates config.watch through to the mounted provider", () => {
    const mounted: { plugin: unknown; config: Record<string, unknown> }[] = [];
    const ctx = {
      plugin: (plugin: unknown, config: Record<string, unknown>) => {
        mounted.push({ plugin, config });
      },
      skills: { register: () => () => {} },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];

    apply(ctx, new Config({ watch: true }));

    const provider = mounted.find((m) => m.config["providerName"] === "game-studio");
    expect(provider!.config["watch"]).toBe(true);
  });
});

describe("orchestration skills", () => {
  it("registers every shipped orchestration skill with substituted paths", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: {
        register: (skill: OrchestrationSkill) => {
          registered.push(skill);
          return () => {};
        },
      },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];

    apply(ctx, new Config({ engine: "godot", reviewIntensity: "lean" }));

    const names = registered.map((s) => s.name).sort();
    expect(names).toEqual([
      "gs-guards", "gs-phase-architecture", "gs-phase-concept", "gs-phase-design",
      "gs-phase-polish", "gs-phase-qa", "gs-phase-release", "gs-phase-sprint",
      "gs-pipeline", "gs-roster", "gs-studio", "gs-templates",
    ]);
    for (const skill of registered) {
      expect(skill.content).not.toContain("%%GS_");
      expect(skill.content).toContain(contentDir());
      expect(skill.source).toBe("runtime");
      expect(skill.resourceBase).toEqual({ kind: "directory", path: contentDir() });
    }
    expect(registered.find((s) => s.name === "gs-studio")!.content).toContain("godot");
    expect(registered.find((s) => s.name === "gs-studio")!.content).toContain("lean");
  });

  it("ships the probe role brief the roster points at", () => {
    expect(existsSync(`${contentDir()}roles/creative-director.md`)).toBe(true);
  });

  it("registers all twelve orchestration skills", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({}));
    expect(registered.map((s) => s.name).sort()).toEqual([
      "gs-guards", "gs-phase-architecture", "gs-phase-concept", "gs-phase-design",
      "gs-phase-polish", "gs-phase-qa", "gs-phase-release", "gs-phase-sprint",
      "gs-pipeline", "gs-roster", "gs-studio", "gs-templates",
    ]);
  });

  it("every delegating phase skill carries the background-mode rule", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({}));
    for (const s of registered.filter((s) => s.content.includes("subagent("))) {
      expect(s.content).toContain("run_in_background: false");
    }
  });

  it("resolves every gs-phase-* name in gs-pipeline's table to a registered orchestration skill", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({}));
    const names = new Set(registered.map((s) => s.name));
    const pipelineText = readFileSync(`${contentDir()}orchestration/gs-pipeline.md`, "utf8");
    const phaseNames = [...pipelineText.matchAll(/`(gs-phase-[a-z]+)`/g)].map((m) => m[1]!);
    // Guards the guard: if the table's markup ever changes shape, this must
    // fail loud rather than silently checking zero names.
    expect(phaseNames.length).toBeGreaterThan(0);
    for (const phaseName of phaseNames) {
      expect(names.has(phaseName), `gs-pipeline.md references ${phaseName}, which is not a registered orchestration skill`).toBe(true);
    }
  });

  it("keeps every orchestration description free of absolute paths", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({}));
    for (const s of registered) {
      expect(s.description).not.toContain("/");
      expect(s.description.length).toBeLessThan(320);
    }
  });
});

describe("exposeCommandSkillsToModel", () => {
  it("defaults to keeping command skills out of the model catalog", () => {
    expect(new Config({}).exposeCommandSkillsToModel).toBe(false);
  });

  it("when off, registers only the twelve orchestration skills", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({}));
    expect(registered).toHaveLength(12);
  });

  it("when on, also registers the command skills as model-invocable", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({ exposeCommandSkillsToModel: true }));
    expect(registered.length).toBeGreaterThan(12);
    const ping = registered.find((s) => s.name === "gs-ping");
    expect(ping?.invocation).toEqual({ modelInvocable: true, userInvocable: true });
  });

  it("registers all 74 command skills, plus the 12 orchestration skills, when on", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({ exposeCommandSkillsToModel: true }));
    expect(registered).toHaveLength(12 + 74);
  });

  it("re-registered command skills keep their frontmatter metadata (argument-hint, model, agent)", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({ exposeCommandSkillsToModel: true }));
    const adopt = registered.find((s) => s.name === "gs-adopt");
    expect(adopt?.metadata).toEqual({
      "argument-hint": "[focus: full | gdds | adrs | stories | infra]",
      model: "sonnet",
      agent: "technical-director",
    });
  });

  it("re-registered command skills carry no unsubstituted %%GS_ marker and no \\r", () => {
    const registered: OrchestrationSkill[] = [];
    const ctx = {
      plugin: () => {},
      skills: { register: (s: OrchestrationSkill) => { registered.push(s); return () => {}; } },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Parameters<typeof apply>[0];
    apply(ctx, new Config({ exposeCommandSkillsToModel: true }));
    const commandSkills = registered.filter((s) => s.name !== "gs-ping" && !s.name.startsWith("gs-phase-") &&
      !["gs-guards", "gs-pipeline", "gs-roster", "gs-studio", "gs-templates"].includes(s.name));
    expect(commandSkills.length).toBeGreaterThan(0);
    for (const s of commandSkills) {
      expect(s.content).not.toContain("%%GS_");
      expect(s.content).not.toContain("\r");
      expect(s.source).toBe("runtime");
    }
  });
});
