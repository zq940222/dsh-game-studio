/**
 * Publish gates and the port manifest.
 *
 * These exist because a broken reference in ported content fails silently:
 * the model follows a path that does not resolve, or types a command the
 * menu does not carry, and nothing errors. The final review of Phase 1
 * caught that failure class at N=6; this phase takes N into the thousands.
 *
 * @module tools/port/manifest
 */
import { isCommand, isRole } from "./inventory.mjs";

/**
 * The exact inventory a complete port produces, measured against the pinned
 * upstream snapshot rather than estimated.
 *
 * `skills` is the AGGREGATE of the 73 skills the port writes and the 1
 * first-party `gs-ping` install probe Phase 1 already ships under
 * `content/skills/` (never touched by the port). Checking only the
 * aggregate here is deliberate — the split that keeps a short port visible
 * behind it (rather than masked by an unrelated extra summing back to 74)
 * lives in the rendered manifest, not in this gate; see {@link renderManifest}.
 *
 * `handbook` is 13, not 12: 12 are ported from the upstream snapshot, and
 * the 13th, `guards.md`, is first-party — sourced from
 * `tools/port/static/`, not the snapshot (see Task 17's `emitStatic`).
 *
 * `roles` is 49 and `templates` is 40, each one short of what is actually
 * on disk: both directories also carry a generated `_index.md` (see
 * port.mjs's roles loop and, since Task 19, its templates loop) that this
 * count deliberately excludes. Each count is derived from the SOURCE loop
 * — `roleNames.length`/`templatesCount`, incremented once per upstream
 * file — computed BEFORE the index is emitted after that loop, so the
 * index is never counted. Disk legitimately holds one more file than the
 * pinned count in both directories; that is the convention, not a missing
 * file.
 */
export const EXPECTED_COUNTS = Object.freeze({
  skills: 74, roles: 49, templates: 40, rules: 11,
  engines: 46, handbook: 13, pipeline: 2, excluded: 10,
});

/**
 * G1: no ported command-skill body may carry a %%GS_ substitution marker.
 *
 * The filesystem provider ships command-skill bodies VERBATIM — there is no
 * substitution pass and no fail-loud scan on that path, unlike the
 * orchestration loader. A %%GS_ marker under content/skills/** would reach
 * the model unsubstituted with no error at all.
 * @param files - the files under content/skills/**, each with its path.
 * @returns one problem per file that still carries a marker.
 */
export function checkMarkerLeaks(files) {
  const problems = [];
  for (const { path, text } of files) {
    if (text.includes("%%GS_")) problems.push(`${path}: contains a %%GS_ substitution marker`);
  }
  return problems;
}

/**
 * Pre-flight check on the SNAPSHOT the port reads from, not the content it
 * writes: does any sampled source file carry CRLF line endings.
 *
 * `fixupClaudeDocResidue` (port.mjs) rewrites a handful of files via exact
 * literal `text.split([FROM]).join([TO])` blocks matched against `\n`-joined
 * upstream text. A single `\r` byte anywhere in a FROM block's span makes
 * the whole block silently no-op — not an error, just raw upstream prose
 * (naming `.claude/`, hooks that no longer exist, etc.) surviving into a
 * shipped file. A snapshot checked out on Windows with the common
 * `core.autocrlf=true` default reproduces this on every line, silently,
 * because the upstream repo carries no `.gitattributes` to override it —
 * see task-17-report.md's "CRLF" finding for the byte-level repro.
 *
 * Sampling a few known files is deliberate, not a shortcut taken under
 * pressure: `core.autocrlf` is a per-checkout setting, so one CRLF byte
 * anywhere in a snapshot means every text file in it has the same line
 * endings — reading the whole tree a second time just to confirm that would
 * cost real time for no additional signal. The caller (port.mjs) picks the
 * sample; this function only judges what it's handed.
 * @param files - `{ path, text }` for each sampled file, as read from the
 *   snapshot. A missing sample file is the SOURCE_ROOTS guard's concern,
 *   not this one — omit it rather than passing an empty text.
 * @returns one problem per CRLF-containing file, each naming the fix.
 */
export function checkSnapshotLineEndings(files) {
  const problems = [];
  for (const { path, text } of files) {
    if (text.includes("\r\n")) {
      problems.push(
        `${path}: snapshot has CRLF line endings — fixupClaudeDocResidue's literal ` +
        `FROM/TO blocks match \\n-joined text and silently no-op on \\r\\n input. ` +
        `Re-extract the snapshot with LF preserved, e.g. ` +
        `\`git -c core.autocrlf=false archive -o <tar> <sha>\` then \`tar -xf <tar> -C <dest>\`, ` +
        `or set core.autocrlf=false before checking out the snapshot.`,
      );
    }
  }
  return problems;
}

/**
 * A relative-path reference this corpus actually uses: a markdown link
 * target or a backtick-quoted bare path, starting with `../` (the
 * unambiguous case — a same-directory reference with no `../` is
 * indistinguishable from an unrelated path-shaped mention in prose and is
 * deliberately not scanned here, to keep this clause free of false
 * positives) and ending in `.md`.
 */
const RELATIVE_REF_RE = /(\]\(|`)(\.\.\/[\w./-]+\.md)(\)|`)/g;

/**
 * G3 clause 3's allowlist: a relative reference that is known not to
 * resolve, and is fine anyway. Keep this explicit and reasoned rather than
 * silently swallowing the problem in the resolver — an unexplained
 * exemption in a gate is how the next one gets added without thought.
 *
 * `skills/gs-patch-notes/SKILL.md` -> `templates/patch-notes-template.md`:
 * this template never existed upstream. The skill reaches it via "glob for
 * X and Y … if not found, use the built-in templates instead", so a miss
 * degrades gracefully rather than failing — see SKILL.md's Phase 2b.
 */
const REFERENTIAL_INTEGRITY_ALLOWLIST = new Set([
  "skills/gs-patch-notes/SKILL.md -> templates/patch-notes-template.md",
]);

/**
 * Resolve a `../`-relative reference against the directory of the file that
 * contains it, POSIX-style, with `path`'s own directory as the base — NOT
 * `content/`'s root. A reference cannot walk above `content/`: this corpus
 * never needs to and a caller doing so is a bug, not a path to resolve, so
 * any `..` beyond the root is simply dropped rather than going negative.
 * @param fromPath - content/-relative path of the file containing the ref.
 * @param ref - the reference text, e.g. `"../modules/input.md"`.
 * @returns the resolved content/-relative path.
 */
function resolveRelativeRef(fromPath, ref) {
  const stack = fromPath.split("/").slice(0, -1);
  for (const part of ref.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/**
 * G3: every reference in the ported corpus must resolve — spec §5's three
 * clauses: every `/gs-x` is one of the 73 shipped commands, every routed
 * role brief exists, and every relative resource path resolves to a real
 * file in the port's own output.
 * @param files - the ported files, each with its content-relative path.
 * @returns one human-readable problem per broken reference.
 */
export function checkReferentialIntegrity(files) {
  const problems = [];
  const knownPaths = new Set(files.map((f) => f.path));
  for (const { path, text } of files) {
    for (const m of text.matchAll(/(?<![\w/-])\/(gs-[a-z0-9-]+)/g)) {
      // isCommand() on the un-prefixed name, not a separately maintained
      // "known ported commands" set — one source of truth, same as the
      // rewrite rule itself, so this check can't quietly desync from it.
      if (!isCommand(m[1].slice(3))) problems.push(`${path}: unknown command /${m[1]}`);
    }
    for (const m of text.matchAll(/roles\/([a-z0-9-]+)\.md/g)) {
      // isRole(), not a bare `ROLES[name] === void 0` lookup: ROLES is a
      // plain object, so `ROLES["constructor"]` is truthy via the prototype
      // chain even though "constructor" is never a real role — the same
      // pitfall rules.mjs documents for transformSkillFrontmatter.
      if (m[1] !== "_index" && !isRole(m[1])) {
        problems.push(`${path}: role brief does not exist: ${m[1]}`);
      }
    }
    for (const m of text.matchAll(RELATIVE_REF_RE)) {
      const ref = m[2];
      const resolved = resolveRelativeRef(path, ref);
      const key = `${path} -> ${resolved}`;
      if (!knownPaths.has(resolved) && !REFERENTIAL_INTEGRITY_ALLOWLIST.has(key)) {
        problems.push(`${path}: relative reference does not resolve: ${ref} (-> ${resolved})`);
      }
    }
    if (text.includes(".claude/")) problems.push(`${path}: leftover upstream path .claude/`);
    if (text.includes("CLAUDE.md")) problems.push(`${path}: leftover CLAUDE.md reference`);
  }
  return problems;
}

/**
 * G4: the port is complete only at the exact expected counts.
 * @param counts - actual counts by group.
 * @returns one problem per mismatch.
 */
export function checkCounts(counts) {
  const problems = [];
  for (const [group, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = counts[group];
    if (actual !== expected) problems.push(`${group}: expected ${expected}, got ${actual}`);
  }
  return problems;
}

/**
 * Render the manifest a human reads to spot a rule that changed too much.
 * @param data - `{ sha, counts, skillsPorted, skillsFirstParty, ruleHits, excluded, bashSites }`.
 *   `skillsPorted`/`skillsFirstParty` are reported alongside the `counts.skills`
 *   aggregate so a short port stays visible even when the aggregate alone
 *   would not show it (see {@link EXPECTED_COUNTS}).
 *   `ruleHits` covers all of R1-R14 (a row per rule, never silently
 *   omitted) and counts SITES — individual matches rewritten, the same
 *   unit spec §5 quotes ("R7 25 处", "R8 111 处") — not files touched. A
 *   value can be a number or an explanatory string, for the handful of
 *   rules with no independent site count of their own: R9 (folded into
 *   R6/R8's own rewritePaths call, no separate code) and R12 (a structural
 *   invariant enforced by construction, not a text rewrite with match
 *   sites). See port.mjs's `rewriteBody` for where each count comes from.
 * @returns markdown.
 */
export function renderManifest(data) {
  const rows = Object.entries(data.ruleHits).map(([r, n]) => `| ${r} | ${n} |`);
  return [
    `# Port manifest`, ``,
    `Upstream: \`${data.sha}\``, ``,
    `## Counts`, ``,
    ...Object.entries(data.counts).map(([k, v]) => `- ${k}: ${v}`),
    `- skills breakdown: ${data.skillsPorted} ported + ${data.skillsFirstParty} first-party`, ``,
    `## Rule hits`, ``, `| rule | hits |`, `|---|---|`, ...rows, ``,
    `## Excluded (${data.excluded.length})`, ``,
    ...data.excluded.map((e) => `- ${e}`), ``,
    `## Bash sites needing manual rewrite (${data.bashSites.length})`, ``,
    ...data.bashSites.map((s) => `- ${s.file}:${s.line} — ${s.text}`), ``,
  ].join("\n");
}
