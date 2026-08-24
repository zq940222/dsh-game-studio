import { describe, expect, it } from "vitest";
import { Config, inject, name } from "../src/index.js";

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
