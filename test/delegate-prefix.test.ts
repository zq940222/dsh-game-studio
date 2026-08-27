import { describe, expect, it } from "vitest";
import { en, zh } from "../src/client/locales.js";
import { withDelegationPrefix } from "../src/client/delegate-prefix.js";

// withDelegationPrefix used to be inline in src/client/index.ts, prepending
// the new prefix and short-circuiting only when the draft already started
// with that *exact* prefix (a bare `draft.startsWith(prefix)` guard). That
// made delegating to role A, then role B, stack B's prefix onto A's instead
// of replacing it: "Delegate to B ...: Delegate to A ...: <user text>".
// Nothing was lost and nothing sent, but a natural "browse roles, click two
// in a row" flow left the user a mess to hand-clean. This file pins the
// fixed behavior: at most one delegation prefix is ever present, any
// user-typed text survives, and the check holds across both shipped
// locales, not just the active one.

const roleA = zh["role.delegatePrefix"].replace("{role}", "gameplay-programmer");
const roleB = zh["role.delegatePrefix"].replace("{role}", "narrative-designer");
const roleAEn = en["role.delegatePrefix"].replace("{role}", "gameplay-programmer");
const roleBEn = en["role.delegatePrefix"].replace("{role}", "narrative-designer");

describe("withDelegationPrefix", () => {
  it("prepends the prefix to an empty draft", () => {
    expect(withDelegationPrefix("", roleA)).toBe(roleA);
  });

  it("prepends the prefix ahead of text the user already typed", () => {
    expect(withDelegationPrefix("please look at the jump arc", roleA)).toBe(`${roleA}please look at the jump arc`);
  });

  it("is idempotent: clicking the same role's card twice does not stack", () => {
    const once = withDelegationPrefix("", roleA);
    const twice = withDelegationPrefix(once, roleA);
    expect(twice).toBe(once);
  });

  it("is idempotent with user text present", () => {
    const once = withDelegationPrefix("fix the camera clipping", roleA);
    const twice = withDelegationPrefix(once, roleA);
    expect(twice).toBe(once);
  });

  it("replaces role A's prefix with role B's instead of stacking (the Task 6 bug)", () => {
    const afterA = withDelegationPrefix("please look at the jump arc", roleA);
    const afterB = withDelegationPrefix(afterA, roleB);
    expect(afterB).toBe(`${roleB}please look at the jump arc`);
    // The bug: this used to equal `${roleB}${roleA}please look at the jump arc`.
    expect(afterB).not.toContain(roleA);
    // Exactly one prefix present.
    expect(afterB.indexOf(roleB)).toBe(0);
  });

  it("replaces back from B to A across a third click, still without stacking", () => {
    const afterA1 = withDelegationPrefix("notes here", roleA);
    const afterB = withDelegationPrefix(afterA1, roleB);
    const afterA2 = withDelegationPrefix(afterB, roleA);
    expect(afterA2).toBe(`${roleA}notes here`);
  });

  it("collapses an already-stacked draft (persisted from before the fix) to a single prefix in one call", () => {
    const stacked = `${roleB}${roleA}notes here`;
    expect(withDelegationPrefix(stacked, roleB)).toBe(`${roleB}notes here`);
  });

  it("recognizes a prefix inserted under the other shipped locale (a mid-session language switch)", () => {
    const afterZh = withDelegationPrefix("notes here", roleA);
    const afterEnClick = withDelegationPrefix(afterZh, roleAEn);
    expect(afterEnClick).toBe(`${roleAEn}notes here`);
  });

  it("recognizes and replaces across a zh -> en -> zh sequence", () => {
    const step1 = withDelegationPrefix("notes here", roleA); // zh, role A
    const step2 = withDelegationPrefix(step1, roleBEn); // en, role B
    expect(step2).toBe(`${roleBEn}notes here`);
    const step3 = withDelegationPrefix(step2, roleB); // zh, role B again
    expect(step3).toBe(`${roleB}notes here`);
  });

  // Documented, accepted trade-off (see delegate-prefix.ts's module doc):
  // user-typed text that happens to match a prefix's head/tail shape at
  // position 0 is indistinguishable from a real inserted prefix and is
  // replaced, same as a real one, on the next delegate click.
  it("treats user text that looks like a prefix as a prefix (documented false positive)", () => {
    const userTypedLookalike = `${roleA}but I typed this myself`;
    const result = withDelegationPrefix(userTypedLookalike, roleB);
    expect(result).toBe(`${roleB}but I typed this myself`);
  });

  // Guards prefixPattern's `template.split("{role}")` assumption: exactly
  // one placeholder. A future template edit that drops or duplicates it
  // would otherwise misparse silently instead of failing loudly here.
  it("each shipped locale's role.delegatePrefix template contains exactly one {role} placeholder", () => {
    for (const dict of [zh, en]) {
      const occurrences = dict["role.delegatePrefix"].split("{role}").length - 1;
      expect(occurrences).toBe(1);
    }
  });
});
