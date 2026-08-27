/**
 * Delegation-prefix insertion for the composer draft.
 *
 * Clicking a role card's delegate button never sends anything — it only
 * edits the composer's current draft, prepending a localized delegation
 * prefix (see `locales.ts`'s `role.delegatePrefix`) ahead of whatever the
 * user already typed. Extracted out of `index.ts` as its own pure module
 * (no DOM, no React, no cordis context) purely so it can be unit-tested
 * without pulling in `Panel.tsx`'s import chain — `panel.css`'s
 * text-loader import in particular only resolves under this package's own
 * esbuild config (`tools/client/build-client.mjs`'s
 * `loader: { ".css": "text" }`), not under vitest's default Vite pipeline.
 *
 * ## Replace, not stack (Task 6 fix)
 *
 * A naive "prepend the new prefix" is idempotent only for the *same* role
 * clicked twice (the original implementation's `draft.startsWith(prefix)`
 * short-circuit). Delegating to role A, then role B, stacked B's prefix
 * onto A's — the draft read
 * `"Delegate to B ...: Delegate to A ...: <user text>"`. Nothing was lost
 * and nothing sent, but browsing roles and clicking two of them in a row
 * is a natural flow, and the second click left a mess the user had to
 * hand-clean.
 *
 * `withDelegationPrefix` below instead *recognizes* any already-inserted
 * delegation prefix — for any role, in either shipped locale — strips it,
 * and prepends the new one, so at most one prefix is ever present
 * regardless of how many times a card was clicked or which locale was
 * active on each click. It strips in a loop rather than once, so a draft
 * that already carries a stacked pair (persisted from before this fix, or
 * pasted in) collapses to a single prefix in one call rather than keeping
 * a second one — "the result has exactly one prefix" is an unconditional
 * postcondition, not one that depends on how the draft got stacked.
 *
 * The prefix is recognized structurally, from the locale templates
 * themselves (`{role}` splits each into a fixed head and tail), not from a
 * roster of role names — a new role added to the catalog needs no update
 * here. Both shipped locales' templates are checked on every call,
 * regardless of which locale is active: switching the UI language between
 * two delegate clicks is a real flow (see the Task 6 verification record's
 * check 1), and a zh-prefixed draft followed by an en delegate click must
 * still replace, not stack.
 *
 * ## Known false positive: user text that happens to look like a prefix
 *
 * Because recognition is structural, a line the *user* typed that happens
 * to start with the same head/tail shape (e.g., pasting text that begins
 * "Delegate to my friend per the gs-roster protocol: ...") is
 * indistinguishable from an inserted prefix and gets replaced on the next
 * delegate click, same as a real one. This is accepted, not guarded
 * against: the alternative (an escape hatch, a hidden marker character)
 * adds real complexity for a coincidence that requires typing a fairly
 * distinctive fixed phrase verbatim at the very start of the draft.
 */
import { en, zh } from "./locales.js";

/** Escapes a string for literal use inside a `RegExp`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex matching an already-inserted delegation prefix at the
 * start of a draft, for one locale's template. `{role}` splits the
 * template into a fixed head and tail; the lazy `.*?` stands in for
 * whatever role name was interpolated there when the prefix was inserted.
 * @param template - a `role.delegatePrefix` dictionary value. Must contain
 * exactly one `{role}` placeholder — both shipped dictionaries do
 * (`test/delegate-prefix.test.ts` pins this so a future template edit that
 * drops or duplicates the placeholder fails loudly here instead of this
 * function silently misparsing it).
 */
function prefixPattern(template: string): RegExp {
  const parts = template.split("{role}");
  if (parts.length !== 2) {
    throw new Error(`role.delegatePrefix template must contain exactly one "{role}": ${JSON.stringify(template)}`);
  }
  const [head, tail] = parts as [string, string];
  return new RegExp(`^${escapeRegExp(head)}.*?${escapeRegExp(tail)}`);
}

/** One matcher per shipped locale — see the module doc's "replace, not stack" section for why both are always checked, regardless of the active locale. */
const DELEGATE_PREFIX_PATTERNS: readonly RegExp[] = [zh, en].map((dict) => prefixPattern(dict["role.delegatePrefix"]));

/**
 * Strips one already-inserted delegation prefix from the front of `text`,
 * trying each shipped locale's pattern in turn.
 * @returns the text with the matched prefix removed, or `undefined` if no
 * pattern matched (nothing to strip).
 */
function stripLeadingPrefix(text: string): string | undefined {
  for (const pattern of DELEGATE_PREFIX_PATTERNS) {
    const match = pattern.exec(text);
    if (match !== null) return text.slice(match[0].length);
  }
  return undefined;
}

/**
 * Inserts a delegation prefix into an existing draft rather than
 * overwriting it, replacing any delegation prefix already leading the
 * draft (any role, any shipped locale) instead of stacking a new one on
 * top of it — see the module doc for the fix this closes and the one
 * accepted false-positive case.
 * @param draft - the current composer draft.
 * @param prefix - the localized delegation prefix for the role just
 * clicked.
 * @returns the next draft to write back with `setDraft`: `prefix`
 * followed by whatever of `draft` was not itself a delegation prefix.
 */
export function withDelegationPrefix(draft: string, prefix: string): string {
  let rest = draft;
  for (let stripped = stripLeadingPrefix(rest); stripped !== undefined; stripped = stripLeadingPrefix(rest)) {
    rest = stripped;
  }
  return rest === "" ? prefix : `${prefix}${rest}`;
}
