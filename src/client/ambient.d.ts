/**
 * Ambient module declaration for the CSS files esbuild's `text` loader
 * turns into plain strings (see tools/client/build-client.mjs). Only
 * `src/client/**` needs this — tsconfig.client.json is the config that
 * includes it.
 */
declare module "*.css" {
  const css: string;
  export default css;
}
