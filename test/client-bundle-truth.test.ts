import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// This is the real guard for tools/client/build-client.mjs's "Purity gate
// (spec U5)" doc comment. That comment used to say "`pnpm build`'s Step 5
// check greps the output for exactly that" — there is no such stage.
// `package.json`'s `scripts.build` is four stages (catalog generate, two
// tsc invocations, esbuild) and none of them greps anything; "Step 5" was
// a one-time manual check from a task brief, never automated. Nothing else
// in the suite mentioned `__ModuleLoader__` or `lib/client` before this
// file, so an esbuild upgrade that dropped an `external`, or an edit that
// broke the wrapper shape, would only fail at materialization on a user's
// machine (blank panel, no build error) — see that file's corrected
// comment and the design doc's U4/U5 rows for why this bundle format is
// this project's one reverse-engineered element.
//
// `lib/` is gitignored (a build product, same as `lib/index.js`), so a
// clean checkout has no `lib/client.js` until something runs `pnpm build`.
// `describe.skipIf` below keeps `pnpm vitest run` runnable standalone on
// such a checkout — the suite reports these as skipped, not failed, and
// `pnpm build` (which runs before `pnpm vitest run` in `scripts.check`)
// is what actually produces the file these assertions read.
const CLIENT_BUNDLE_PATH = fileURLToPath(new URL("../lib/client.js", import.meta.url));
const hasBundle = existsSync(CLIENT_BUNDLE_PATH);

/** Exactly what the host's require shim may resolve on its own (U5) — see build-client.mjs's EXTERNAL list. */
const INTENDED_EXTERNALS = new Set(["react", "react/jsx-runtime", "react-dom/client"]);

function readBundle(): string {
  return readFileSync(CLIENT_BUNDLE_PATH, "utf8");
}

describe.skipIf(!hasBundle)("lib/client.js (built bundle) purity gate", () => {
  it("opens with the ModuleLoader wrapper and this package's id", () => {
    const body = readBundle();
    expect(body.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    expect(body).toContain('id: "dsh-game-studio"');
  });

  it("requires exactly the intended externals across the factory boundary", () => {
    const body = readBundle();
    const required = new Set([...body.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]));
    expect(required).toEqual(INTENDED_EXTERNALS);
  });

  it("requires zero @deepseek-ai packages (the bundle genuinely needs none)", () => {
    const body = readBundle();
    const deepseekRequires = [...body.matchAll(/require\(["'](@deepseek-ai\/[^"']+)["']\)/g)].map((m) => m[1]);
    expect(deepseekRequires).toEqual([]);
  });
});
