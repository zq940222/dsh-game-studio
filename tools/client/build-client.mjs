#!/usr/bin/env node
/**
 * Bundles `src/client/index.ts` into `lib/client.js`, in the format the
 * web host's `ClientModuleLoader` expects: a
 * `window.__ModuleLoader__.load({ id, factory })` call that only
 * REGISTERS the factory — module body side effects (including this
 * bundle's CSS injection) run at materialization time, inside
 * `factory(require)`, not at script-execution time (per
 * `@deepseek-ai/dsh-client-modules`'s README, "Lazy CJS model (web2)").
 *
 * Purity gate (spec U5): everything not listed in `external` below must
 * end up inlined into the factory closure; only names the host's require
 * shim can resolve on its own (`react`, its subpaths, and every
 * `@deepseek-ai/dsh-client-*` package) may cross the factory boundary as
 * `require(...)` calls. `pnpm build`'s Step 5 check greps the output for
 * exactly that.
 *
 * The wrapper shape below is copied from the reference package's own
 * built output (`@linxin666/dsh-client-ui-task-board`'s `lib/client.js`),
 * not invented — see task-3-report.md.
 *
 * @module dsh-game-studio/tools/client/build-client
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";

const EXTERNAL = ["react", "react/jsx-runtime", "react-dom/client", "react-dom"];

const result = await build({
  entryPoints: ["src/client/index.ts"],
  // write:false + outfile: esbuild needs a nominal output path to compute
  // the external source map's name/URL from, even though it never writes
  // there itself (writeFileSync below does that, after the wrap).
  outfile: "lib/client.js",
  bundle: true,
  write: false,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  sourcemap: "external",
  // @deepseek-ai/dsh-client-* are also external: the host's require shim
  // resolves them from the boot graph, not from this bundle.
  external: [...EXTERNAL, "@deepseek-ai/*"],
  loader: { ".css": "text" },
});

const body = result.outputFiles.find((f) => f.path.endsWith(".js"))?.text;
if (body === undefined) {
  throw new Error("esbuild produced no .js output file");
}
const map = result.outputFiles.find((f) => f.path.endsWith(".js.map"));

// The factory receives `require` and must return module.exports. esbuild's
// cjs output writes into `module.exports` assuming both bindings exist, so
// the wrapper declares them — matching the reference bundle's shape.
const wrapped = [
  `window.__ModuleLoader__.load({`,
  `\tid: "dsh-game-studio",`,
  `\tfactory: (require) => {`,
  `\t\tvar module = { exports: {} };`,
  `\t\tvar exports = module.exports;`,
  body,
  `\t\treturn module.exports;`,
  `\t}`,
  `});`,
  ...(map ? ["", "//# sourceMappingURL=client.js.map"] : []),
  "",
].join("\n");

mkdirSync("lib", { recursive: true });
writeFileSync("lib/client.js", wrapped);
if (map) writeFileSync("lib/client.js.map", map.text);

console.log(`client: wrote lib/client.js (${body.length} bytes bundled)`);
