import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentDir } from "../src/content.js";

const MAP_PATH = new URL("../tools/port/static/command-phases.md", import.meta.url);

/** The seven phase names, verbatim from gs-pipeline.md's table. */
const PHASES = ["Concept", "Design", "Architecture", "Sprint", "QA", "Polish", "Release"] as const;

/** Parse the two-column table into command -> phase. */
function readMap(): Map<string, string> {
  const text = readFileSync(MAP_PATH, "utf8");
  const out = new Map<string, string>();
  for (const m of text.matchAll(/^\|\s*(gs-[a-z0-9-]+)\s*\|\s*([A-Za-z]+)\s*\|$/gm)) {
    out.set(m[1]!, m[2]!);
  }
  return out;
}

describe("command-phases.md tells the truth", () => {
  const map = readMap();
  const onDisk = readdirSync(`${contentDir()}skills`).filter((d) => d.startsWith("gs-"));

  it("parses a non-trivial number of rows", () => {
    expect(map.size).toBeGreaterThan(70);
  });

  it("covers every shipped command, and invents none", () => {
    const mapped = [...map.keys()].sort();
    expect(mapped).toEqual([...onDisk].sort());
  });

  it("uses only the seven phase names from gs-pipeline.md", () => {
    const bad = [...map.entries()].filter(([, p]) => !PHASES.includes(p as typeof PHASES[number]));
    expect(bad).toEqual([]);
  });

  it("agrees with gs-pipeline.md on what the seven phases are", () => {
    const pipeline = readFileSync(`${contentDir()}orchestration/gs-pipeline.md`, "utf8");
    const inTable = [...pipeline.matchAll(/^\|\s*\d\s*\|\s*([A-Za-z]+)\s*\|/gm)].map((m) => m[1]!);
    expect(inTable).toEqual([...PHASES]);
  });

  it("assigns each command exactly once", () => {
    const text = readFileSync(MAP_PATH, "utf8");
    const names = [...text.matchAll(/^\|\s*(gs-[a-z0-9-]+)\s*\|/gm)].map((m) => m[1]!);
    expect(names.length).toBe(new Set(names).size);
  });
});
