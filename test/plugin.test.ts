import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
    expect(provider!.config["includeDefaultRoots"]).toBe(false);
    expect(provider!.config["watch"]).toBe(false);
    expect(provider!.config["customSkillDirs"]).toEqual([`${contentDir()}skills/`]);
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
    expect(names).toEqual(["gs-roster", "gs-studio"]);
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
});
